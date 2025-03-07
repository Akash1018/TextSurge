import puppeteer from "puppeteer";
import Job from "./models/Job.js";
import Profile from "./models/Profile.js";
import { configDotenv } from "dotenv";
configDotenv();

const browser = await puppeteer.launch({
  headless: false, // Show the browser UI
  args: ["--disable-blink-features=AutomationControlled"], // Prevent bot detection);
});
const page = await browser.newPage();

const loginTolinkedIn = async () => {
  await page.goto("https://www.linkedin.com/login");
  await page.type("#username", process.env.EMAIL);
  await page.type("#password", process.env.PASSWORD);
  await page.click('[type="submit"]');
  await page.waitForNavigation();
  return true;
};

const isConnected = await loginTolinkedIn();
console.log("login", isConnected);

let activeTask = null; // Tracks the currently running function
let processJobsQueued = false; // Flag to track if processJobs is waiting to run

const processJobs = async () => {
  if (activeTask) {
    console.log(`⏳ ${activeTask} is running. Queuing processJobs.`);
    processJobsQueued = true;
    return;
  }

  activeTask = "processJobs";
  console.log("🚀 Starting processJobs");
  const jobs = await Job.find({ status: "pending" });

  for (let job of jobs) {
    console.log(`Searching for referrals at ${job.company}`);

    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${job.company}`;
    await page.goto(searchUrl);

    const profiles = await extractProfiles();

    // messaging 5 open profiles
    if (profiles) {
      // messaging 5 open profiles (not working rn)
      const openProfiles = profiles.filter((p) => p.isOpen).slice(0, 5);
      console.log(JSON.stringify(openProfiles));

      for (let profile of openProfiles) {
        console.log("sending message");
        await sendMessage(profile.url, job);
      }

      // sending connection req
      const lockedProfiles = profiles.filter((p) => !p.isOpen);
      console.log("locked", lockedProfiles.length);
      for (let profile of lockedProfiles) {
        await Profile.create({ linkedinUrl: profile.url, jobId: job._id });
      }

      job.status = "processing";
      await job.save();
    }
  }

  activeTask = null; // Unlock
  console.log("✅ Finished processJobs.");

  // If processJobs was queued while another function was running, run it now
  if (processJobsQueued) {
    processJobsQueued = false;
    processJobs();
  }
  // await browser.close();
};

// Checking stored profiles every 5 minutes
const processAcceptedProfiles = async () => {
  if (activeTask || processJobsQueued) {
    console.log(
      `⏳ ${activeTask} is running or processJobs is queued. Skipping processAcceptedProfiles.`
    );
    return;
  }

  activeTask = "processAcceptedProfiles";
  console.log("🚀 Checking accepted connection requests");
  const profiles = await Profile.find({ status: "pending" });

  for (let profile of profiles) {
    console.log(`🔄 Checking if ${profile.linkedinUrl} accepted request...`);
    await page.goto(profile.linkedinUrl);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const withdrawAvailable =
      (await page.$(
        "button[aria-label^='Pending, click to withdraw invitation']"
      )) !== null;

    const followAvailable =
      (await page.$("button[aria-label^='Follow']")) !== null;
    if (!withdrawAvailable && !followAvailable) {
      const job = await Job.findById(profile.jobId);
      const res = await sendMessage(profile.linkedinUrl, job);
      console.log("result", res);
      if (res) await Profile.deleteOne({ jobId: profile.jobId });
    }
  }

  activeTask = null;
  console.log("✅ Finished processAcceptedProfiles.");

  // If processJobs was queued while this was running, run it now
  if (processJobsQueued) {
    processJobsQueued = false;
    processJobs();
  }
};

const sendMessage = async (profileUrl, job) => {
  try {
    const newPage = page; // Open a new tab for sending messages (create multiple pages if your network is slow)
    await newPage.goto(profileUrl);

    const messageOpened = await newPage.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('button[aria-label^="Message"]')
      );
      for (let button of buttons) {
        if (button.innerText.includes("Message")) {
          button.click();
          return true;
        }
      }
      return false;
    });

    if (!messageOpened) {
      console.error("Message button not found or could not be clicked");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log("Job Data:", job);

    const sendStatus = await newPage.evaluate(
      ({ position, company, jobId }) => {
        return new Promise((resolve) => {
          const messageContainer = document.querySelector(
            'div[aria-label="Write a message…"]'
          );
          const sendButton = document.querySelector(
            "button.msg-form__send-button"
          );

          if (messageContainer && sendButton) {
            messageContainer.innerHTML = `<p>Enter your text here</p>`

            const inputEvent = new Event("input", { bubbles: true });
            messageContainer.dispatchEvent(inputEvent);

            const enterEvent = new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key: "Enter",
              code: "Enter",
            });
            messageContainer.dispatchEvent(enterEvent);
            console.log(sendButton);
            setTimeout(() => {
              sendButton.click();
              resolve(true);
            }, 3000);
          } else {
            console.error("Message container or send button not found");
            resolve(false);
          }
        });
      },
      job
    );
    if (!sendStatus) {
      console.error("Failed to send message.");
    }
    await new Promise((r) => setTimeout(r, 3000));
    return true;
    // kill browser if using multiple
  } catch (error) {
    console.error("Error in sendMessage:", error);
  }
};

const sendConnectionReq = async () => {
  if (activeTask || processJobsQueued) {
    console.log(
      `⏳ ${activeTask} is running or processJobs is queued. Skipping sendConnectionReq.`
    );
    return;
  }

  activeTask = "sendConnectionReq";
  console.log("🚀 Sending connection requests");
  const profiles = await Profile.find({ status: "Connect" });
  console.log(profiles);
  for (let profile of profiles) {
    await page.goto(profile.linkedinUrl);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    try {
      const success = await page.evaluate(() => {
        const connectButton = document.querySelector(
          'button[aria-label^="Invite"][aria-label$="to connect"]'
        );
        if (connectButton) {
          connectButton.click();
          return true;
        }
        return false;
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (success) {
        await page.evaluate(async () => {
          const skipButton = document.querySelector(
            'button[aria-label="Send without a note"]'
          );
          console.log(skipButton);
          if (skipButton) {
            skipButton.click();
          }
        });
        console.log(`✅ Sent request to ${profile.linkedinUrl}`);
      } else {
        console.log(`⚠️ No connect button found on ${profile.linkedinUrl}`);
      }
      profile.status = "pending";
      await profile.save();
    } catch (err) {
      console.log(123, err);
    }
  }

  activeTask = null;
  console.log("✅ Finished sendConnectionReq.");

  // If processJobs was queued while this was running, run it now
  if (processJobsQueued) {
    processJobsQueued = false;
    processJobs();
  }
};

const extractProfiles = async () => {
  try {
    let profiles = [];
    let currentPage = 1;
    const maxPages = 4;

    while (currentPage <= maxPages) {
      console.log(`📄 Scraping page ${currentPage}...`);

      // Wait for 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Extract profile URLs
      const newProfiles = await page.evaluate(() => {
        const results = [];
        const check = new Set();
        document.querySelectorAll("a[href*='/in/']").forEach((el) => {
          const profileUrl = el.href.split("?")[0]; // Clean profile URL
          if (!check.has(profileUrl)) {
            results.push({ url: profileUrl, isOpen: false });
            check.add(profileUrl);
          }
        });
        return results;
      });

      console.log(
        `🔹 Found ${newProfiles.length} profiles on page ${currentPage}`
      );

      // Append new profiles while avoiding duplicates
      profiles = [...profiles, ...newProfiles];

      // Check for a "Next" button and go to the next page
      const nextButton = await page.$("button[aria-label='Next']");
      if (nextButton) {
        await nextButton.click();
        console.log(nextButton);
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 3 seconds to allow new results to load
      } else {
        console.log("🚫 No more pages found.");
        break;
      }

      currentPage++;
    }

    console.log(`✅ Total profiles collected: ${profiles.length}`);
    return profiles.slice(0, 16); // Limit to 16 profiles across pages
  } catch (error) {
    console.log("Not working", error);
  }
};

async function executeTasks() {
  if (activeTask || !isConnected) return; // Prevent overlapping execution

  try {
    console.log("⏳ Running processAcceptedProfiles...");
    await processAcceptedProfiles();
    console.log("✅ Finished processAcceptedProfiles.");

    console.log("⏳ Running sendConnectionReq...");
    await sendConnectionReq();
    console.log("✅ Finished sendConnectionReq.");
  } catch (error) {
    console.error("❌ Error in execution:", error);
    process.exit();
  } finally {
    activeTask = null;
  }
}

// Run every 20 seconds (adjust timing as needed)
setInterval(executeTasks, 30000);

export default processJobs;
