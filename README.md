# GBF Poker Bot

## Overview
The **GBF Poker Bot** is a Tampermonkey userscript designed to automate the poker mini-game in Granblue Fantasy (GBF). It observes the game state and make decisions during gameplay. 

TL;DR: It plays Poker and gets Christina and those fancy outfits for you.

## ⚠️DISCLAIMER
<b>This script is provided for educational purposes only. Use it at your own risk. The author is not responsible for any consequences resulting from its use.</b>

## 🚀Features
- **Automate Gameplay**: Automatically plays the poker game, including dealing, keeping cards, and making high/low decisions.
- **Keep Logic**: Decide which cards to keep based on hand strength and potential.
- **Double-Up Logic**: Selects "High" or "Low" during the double-up phase based on card rank.
- **Session Statistics**: Tracks and displays gameplay statistics, including chips earned, number of draws, and session duration.
- **Auto Reboot**: Automatically reloads the page and restarts the bot after a specified interval.

## 📖 Usage
### Prerequisite
1. Install [Tampermonkey](https://www.tampermonkey.net/) or a similar userscript manager in your browser.
2. Copy the contents of `GBF-Poker-Bot.user.js`.
3. Create a new userscript in Tampermonkey and paste the copied code.
4. Save the script and ensure it is enabled.

### Usage
1. Navigate to the Granblue Fantasy poker game page, where you can tap the 'DEAL' button.
2. The bot will automatically start after 5 seconds if `autoReboot` is enabled.
3. Use the on-screen control button to manually start or stop the bot:
   - **Start**: Begins the bot's operation.
   - **Stop**: Halts the bot and displays session statistics.

## ⚙️Configuration
You can customize the bot's behavior by modifying the `userConfig` object in the script:
- `verbose`: Set to `true` to enable detailed logging in the console.
- `ttl`: Time-to-live for the bot in minutes. The bot will stop after this duration.
- `autoReboot`: Set to `true` to enable automatic page reload and bot restart.
- `rebootInterval`: Interval (in minutes) before the bot restarts after a page reload.
- `AdditionalWaitTime`: Additional random wait time (in minutes) before rebooting.
- `saveLog`: Set to `true` to save session logs in Tampermonkey's storage.
- `displayPerXRounds`: Number of rounds after which statistics are displayed in the console.

## 📜Log
The bot tracks the following statistics:  
Example log:  
```json
{
    "time": "2025/5/6 18:42:54",
    "duration": 46,
    "draws": 190,
    "initialChips": 48075735,
    "chipsEarned": 9026000,
    "info": "Stop Gracefully."
}
```
## 🚧TODO
This project is still under development. Known issue:

- Error Handling: "通信エラー"(connection issue) and Verification are not handled properly.
- UI Improvements: Enhance the on-screen control panel for better usability.

If you encounter additional issues or have suggestions, feel free to open an issue or contribute to the project.

## 👏Credits
This project is impossible without the inspirations and ideas from the GBF open source community!! Special thanks to [kevin01523](https://github.com/kevin01523/GBF-poker-script) and [YANFLY](http://yanfly.moe/games/gbf/how-to-not-suck-at-granblue-fantasys-poker/)!!

If you believe your work has been used and is not properly credited, please contact the author to update this section.

## License
This project is licensed under the MIT License.
