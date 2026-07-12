# How to add locations to the game
This is a guide which you can follow *in order* to add your own locations to the game.

**NOTE:** This requires a GitHub account. If you don't know what it is then don't worry, it's a very common tool used by tons of programmers. They are owned by Microsoft so it's not some shady website, and it's free. Once you have an account I will walk you through all the steps so you don't need to actually know how it works.

0) Make a github account.

## Forking the repo on GitHub
This project is on GitHub's servers somewhere and it helps people collaborate on projects. I control the project and approve your new locations before it actually gets on the website (I won't do much curating though. I just check that it is correct, so have fun making new locations!) 

I won't bore you with the details of how it works, only that the public website exists on a server and you will be making a copy of the project under your own GitHub account. You edit that copy through the GitHub website and then send your changes to me to pull into the public website. Nothing needs to be installed or downloaded for this part.

1) Go to `github.com/JonathanAckerman/roo_guessr`
2) In the top right there's a list of buttons: Pin, Watch, *Fork*, Star. Click `Fork` then `Create fork` (you don't need to change any settings). Creating a fork creates a copy of RooGuessr under your GitHub account. Nothing is installed or downloaded, and GitHub will bring you straight to the top level of your fork.

## Getting set up to take screenshots in Dota
0) Open dota
1) In settings search "console" and check `Enable console` and set a Console hotkey. You might need to set the `-console` launch option through steam, you can google it if need be.
2) Click `Custom Lobby` and `+ Create`
3) Click `Edit` in the bottom right
    - uncheck: `Fill Empty Slots With Bots`
4) Press `Start Game` and get onto the map
5) Open the console
6) Use the console commands listed in the `Console Commands` section below

## Dota Console Commands
```text
// Use all these in order

sv_cheats 1                       // enables cheats
dota_camera_allow_freecam 1       // enables you to toggle free camera
dota_toggle_free_camera           // actually toggles the free camera
fog_enable 0                      // turns off fog
dota_creeps_no_spawning 1         // turns off creeps
dota_daynightcycle_pause 1        // pauses day night cycle
dota_daynightcycle_toggle         // daytime preferred so there's no clouds
r_farz 100000                     // lets you see the whole map at once
freecamera_max_speed 1000         // if you want to change the camera speed
hud_toggle_visibility             // toggles all HUD visibility
```

**NOTE:** some of these don't auto-complete in the text box but will work anyways

## Dota's Free Camera Controls
```text
Up / Down Arrows     = move camera forward and back (in the direction the camera is pointing)
Left / Right Arrows  = move the camera left and right (relative to the camera direction)
Hold Shift           = camera moves faster
```

## Taking screenshots in Dota
1) Fly around looking for good spots! You want spots which are unique/interesting with some identifiable clues for the player to use...a nondescript patch of dirt would be impossible to deduce for anyone but rainbolt.
2) Take a screenshot to use as the question (must be at least 1400px x 1000px. Cropping happens on the website's editor so don't worry about that yet)
    **IMPORTANT:** *Make a note of where this roughly is on the map. You will need to remember this when you choose where the answer pin goes. I like to have a text file which I Alt+Tab to and write an ordered list of descriptions like "near mid T2 on the right side" for example. In theory step 3 should answer this for you but just in case.*
3) Fly to a spot which gives enough context of your zoomed in question image to reveal where that location is and take another screenshot (also at least 1400x1000). Try to make it super obvious where it is, so you might include a tower or shopkeeper or rosh pit. This will only be revealed after the player guesses so it will act like an "answer key".

**NOTE:** At this point you should have two screenshots per location, and you should know where they are on the map.

## Using the RooGuessr editor
1) To make it easier create a folder somewhere on your computer to save/extract all zips into. Something like `C:/Users/.../Downloads/my-new-locations`
2) Go to `rooguessr.peasantroad.com` and click the "Add your own" button in the top right of the main page to be brought to the editor page
3) Under `Question image`, choose your close-up screenshot. This is what we will ask the player. If it is larger than 1400x1000, drag the crop box to frame it.
4) Under `Answer image`, choose your context screenshot. This is what we show after they guess. Position its crop separately from the question crop.
5) Left click on the map to choose where the answer pin will go (this is why you wrote down a reminder note for where it is).
6) Click `Export ZIP` and save it to your folder from step 1. The button will only become available once both images and the answer pin are ready.
7) Extract the ZIP. The resulting UUID folder should directly contain `question.webp`, `answer.webp`, and `answer.txt` (not another folder with the same UUID inside it).

## Formatting and Submitting for approval
This is the "hard part" if you are unfamiliar; just follow along and you should be fine.

1) Go to `github.com/<your-username>/roo_guessr`.
2) Click the `src` folder
3) Click the `locations` folder
4) Click `Add file` in the top right then `Upload files`.
5) Drag all the UUID folders you extracted into the box to upload (*Do not include the .zip files*). Each UUID folder should contain exactly `question.webp`, `answer.webp`, and `answer.txt`.
6) Below that box you should see a `Commit changes` area. Click the radio button for `Create a new branch for this commit and start a pull request.` (You don't need to change anything else.)
7) Click `Propose changes`.
8) Before submitting, make sure the pull request shows:
    - `base repository: JonathanAckerman/roo_guessr`
    - `base: main`
    - `head repository: <your-username>/roo_guessr`
    - your newly created branch as the final selection
9) Fill out the description and checklist, then click `Create pull request`.
10) Click the `Files changed` tab and make sure it only contains the UUID folders you meant to submit. Each new location should contain the same three files listed above. If you see anything unrelated, leave a comment explaining it before I review the pull request.

You're done! Now I review it and add it in. I know this is a bit of an...involved process but I hope this guide is straight-forward enough for you to have fun giving it a go. 

Thanks for contributing!

--peasant road
