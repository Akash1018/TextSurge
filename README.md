# Project Name

## Installation

### Step 1: Install Dependencies

Run the following command to install the necessary dependencies:

```sh
npm install
```

### Step 2: Create an Environment File

Create a `.env` file in the root directory and add your keys:

```ini
TELEGRAM_USER_ID= 
TELEGRAM_BOT_TOKEN= :-nI3PMV6HxGozI
EMAIL= abc@gmail.com 
PASSWORD= password 
DB= mongodb key
```

### Step 3: Run the Script

Execute the script using the following command:

```sh
start restart.bat
```

## Working

1. We send a text message through our phone to a Telegram bot that we created.
2. The message format should be:
   ```plaintext
   company: name
   position: name
   Job Id: name
   ```
3. Once the message is sent, the system:
   - Searches through the company page.
   - Stores the information in a database.
   - Sends a request to the company.
   - Checks for a few minutes if the request is accepted.
4. If the request is accepted, you can send a customized text message.

## Technology Used

- [Express](https://expressjs.com/)
- [Puppeteer](https://pptr.dev/)
- [MongoDB](https://www.mongodb.com/)

## License

[Specify your project's license here]

## Contributions

Feel free to open issues or submit pull requests to improve this project.

