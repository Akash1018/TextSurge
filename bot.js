import puppeteer from "puppeteer";
import Job from "./models/Job.js";
import Profile from "./models/Profile.js";
import { configDotenv } from "dotenv";
configDotenv();

const browser = await puppeteer.launch({
  headless: false,
  args: [
    "--disable-blink-features=AutomationControlled",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-low-res-tiling",
    "--force-device-scale-factor=1",
  ],
});

const page = await browser.newPage();

await page.evaluate(() => {
  document.addEventListener("visibilitychange", () => {
    console.log(`Visibility changed: ${document.visibilityState}`);
  });

  window.requestIdleCallback = (cb) => setTimeout(cb, 0);
});


const loginTolinkedIn = async () => {
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });
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
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    const connections = await Profile.find({
      company: job.company,
      status: "done",
    });
    console.log("Already Connection", connections);
    if (connections) {
      for (let person of connections) {
        await sendMessage(person.linkedinUrl, job);
      }
    }
    await new Promise((resolve) =>
      setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
    );

    const profiles = await extractProfiles(connections.length);

    // messaging 5 open profiles
    if (profiles) {
      // messaging 5 open profiles (not working rn)
      // const openProfiles = profiles.filter((p) => p.isOpen).slice(0, 5);
      // console.log(JSON.stringify(openProfiles));

      // for (let profile of openProfiles) {
      //   console.log("sending message");
      //   await sendMessage(profile.url, job);
      // }

      // sending connection req
      const lockedProfiles = profiles.filter((p) => !p.isOpen);
      console.log("locked", lockedProfiles.length);
      for (let profile of lockedProfiles) {
        await Profile.create({
          linkedinUrl: profile.url,
          jobId: job._id,
          company: job.company,
        });
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
    // processJobs();
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
    await new Promise((resolve) =>
      setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
    );
    await page.goto(profile.linkedinUrl, { waitUntil: "domcontentloaded" });
    await new Promise((resolve) =>
      setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
    );
    const job = await Job.findById(profile.jobId);
    console.log(job);
    const sended = await sendMessage(profile.linkedinUrl, job);
    if (sended) {
      profile.status = "done";
      await profile.save();
      console.log(profile);
    }
  }

  activeTask = null;
  console.log("✅ Finished processAcceptedProfiles.");

  // If processJobs was queued while this was running, run it now
  if (processJobsQueued) {
    processJobsQueued = false;
    // processJobs();
  }
};

const sendMessage = async (profileUrl, job) => {
  try {
    // const newPage = page; // Open a new tab for sending messages (create multiple pages if your network is slow)
    // await newPage.goto(profileUrl, { waitUntil: "load" });

    await new Promise((res) =>
      setTimeout(res, (Math.floor(Math.random() * 5) + 1) * 1000)
    );

    const messageOpened = await page.evaluate(() => {
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

    await new Promise((resolve) =>
      setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
    );
    console.log("Job Data:", job);

    const sendStatus = await page.evaluate(({ position, company, jobId }) => {
      return new Promise((resolve) => {
        const messageContainer = document.querySelector(
          'div[aria-label="Write a message…"]'
        );
        const sendButton = document.querySelector(
          "button.msg-form__send-button"
        );

        if (messageContainer && sendButton) {
          if (jobId != "undefined") {
            messageContainer.innerHTML = "Enter your text here"
          }

          const inputEvent = new Event("input", { bubbles: true });
          messageContainer.dispatchEvent(inputEvent);

          const enterEvent = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Enter",
            code: "Enter",
          });
          messageContainer.dispatchEvent(enterEvent);

          setTimeout(() => {
            sendButton.click();

            setTimeout(() => {
              const closeButton = Array.from(
                document.querySelectorAll(
                  "button.msg-overlay-bubble-header__control"
                )
              ).find((btn) => {
                const span = btn.querySelector("span.artdeco-button__text");
                return (
                  span &&
                  span.textContent.includes("Close your conversation with")
                );
              });
              if (closeButton) {
                console.log("Closing message window...");
                closeButton.click();
              } else {
                console.error("Close button not found");
              }

              resolve(true);
            }, 5000); // Wait 2 seconds before closing the window
          }, 5000);
        } else {
          console.error("Message container or send button not found");
          resolve(false);
        }
      });
    }, job);
    if (!sendStatus) {
      console.error("Failed to send message.");
      return false;
    }
    await new Promise((r) => setTimeout(r, 3000));
    return true;
    // kill browser if using multiple tabs
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
  for (let profile of profiles) {
    await page.goto(profile.linkedinUrl, { waitUntil: "domcontentloaded" });
    try {
      const success = await page.evaluate(async () => {
        const connectButton = document.querySelector(
          'button[aria-label^="Invite"][aria-label$="to connect"]'
        );

        await new Promise((resolve) =>
          setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
        );
        if (connectButton) {
          connectButton.click();
          return true;
        } 

        const userName = document.querySelector('h1.inline.t-24.v-align-middle.break-words')?.textContent.trim();
        const moreButton = document.querySelector(
          `div[aria-label="Invite ${userName} to connect"`
        );
        if(moreButton) {
          moreButton.click();
          return true;
        }
        return false;
      });
      await new Promise((resolve) =>
        setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
      );

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
    // processJobs();
  }
};

const extractProfiles = async (size) => {
  try {
    let profiles = [];
    if (size >= 10) return profiles;
    let currentPage = 1;
    const maxPages = 4;

    while (currentPage <= maxPages) {
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
      console.log(`📄 Scraping page ${currentPage}...`);

      // Wait for some seconds
      await new Promise((resolve) =>
        setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
      );

      // Extract profile URLs
      const newProfiles = await page.evaluate(() => {
        const results = [];
        const check = new Set();
        document.querySelectorAll("a[href*='/in/']").forEach(({ href }) => {
          const profileUrl = href.split("?")[0]; // Clean profile URL
          const profileName = profileUrl.split("/in/")[1];

          // Skip if already added or if it's a mutual connection
          if (
            !check.has(profileUrl) &&
            /^[a-zA-Z0-9-]+$/.test(profileName) &&
            !profileName.startsWith("ACo")
          ) {
            check.add(profileUrl);
            results.push({ url: profileUrl, isOpen: false });
            console.log(profileUrl);
          }
        });
        return results;
      });

      console.log(
        `🔹 Found ${newProfiles.length} profiles on page ${currentPage}`
      );

      // Append new profiles while avoiding duplicates
      profiles = [...profiles, ...newProfiles];
      await new Promise((resolve) =>
        setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
      );
      // Check for a "Next" button and go to the next page
      const nextButton = await page.$("button[aria-label='Next']");
      if (nextButton) {
        nextButton.click();
        await new Promise((resolve) =>
          setTimeout(resolve, (Math.floor(Math.random() * 2) + 1) * 10000)
        ); // Wait 5 seconds to allow new results to load
      } else {
        console.log("🚫 No more pages found.");
        break;
      }

      currentPage++;
    }

    console.log(`✅ Total profiles collected: ${profiles.length}`);
    return profiles.slice(0, 20 - size); // Limit to 20 profiles across pages
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

const deleteOldJobs = async () => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);

    await Job.deleteMany({ createdAt: { $lt: threeDaysAgo } });
    console.log("Old Job Deleted");
  } catch (error) {
    console.log(err);
  }
};

const deleteOldProfiles = async () => {
  try {
    activeTask = true;
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);

    await Profile.deleteMany({
      createdAt: { $lt: threeDaysAgo },
      status: "pending",
    });
    console.log("Old Profiles Deleted");
  } catch (error) {
    console.log(err);
  } finally {
    activeTask = false;
  }
};

// Running every 20 min (adjust timing as needed)
setInterval(executeTasks, 10000);
setInterval(deleteOldJobs, 60 * 60 * 1000);
setInterval(deleteOldProfiles, 60 * 60 * 1000);
setInterval(processJobs, 5 * 60 * 100);

export default processJobs;
