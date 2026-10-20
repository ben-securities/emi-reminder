# iOS Reminders App (To Do List)

A faithful, interactive recreation of the To Do List / Reminders app based on your reference design screenshots.

## ✨ Features

- **Exact Visual Design**:
  - Deep dark blue navy palette with subtle doodle sketch background texture.
  - Section-based task groups: **Overdue** (coral reddish header), **Tomorrow**, **October**, **November**, etc.
  - Interactive task cards with custom checkbox check animations, due date with repeat frequency icon, and category pill badges (`Personal`, etc.).
  - Signature rounded-square Floating Action Button (FAB) for adding tasks and saving tasks.

- **Navigation Drawer**:
  - Brand header: Blue circle checkmark badge & "To Do List by Splend Apps".
  - List filters with active indicator and badge count counters: `All Lists (7)`, `Default`, `Personal (7)`, `Shopping`, `Wishlist`, `Work`, `Finished`.
  - List editor dialog to add and remove custom task categories.
  - Bottom bar with Settings and Dark/Light theme toggle.

- **New Task Screen**:
  - "What is to be done?" field with Speech-to-Text Microphone voice dictation (Web Speech API).
  - "Add in Batch Mode" switch to quickly enter multiple reminders back-to-back.
  - "Notification" section with quick-date chips (Today, Tomorrow, Next Week) and custom date-time picker.
  - Repeat options (Daily, Weekly, Monthly, Yearly).
  - Task List category selector with an inline "Create New List" button.
  - Save button (Checkmark FAB).

- **Audio & Haptic Feedback**:
  - Built-in Web Audio API synthesizer for task completion chimes and button taps.

- **Data Persistence**:
  - Full `localStorage` persistence — your created tasks, custom lists, completions, and theme preferences remain saved.
  - Preloaded with the exact tasks from your reference screenshot:
    - *Home Current Bill* (Thu, Oct 1, 10:45 AM)
    - *Bank 8000* (Thu, Oct 1, 11:35 AM)
    - *Rent current Bill* (Thu, Oct 1, 11:40 AM)
    - *Sony ZV-E10 4500rs 15th bill* (Tomorrow)
    - *Monitor 1800 20th bill* (Sun, Oct 18)
    - *20th bill genaration* (Mon, Oct 19, 10:50 AM)
    - *Rent 7000* (Sun, Nov 1, 10:30 AM)

- **Responsive Viewports**:
  - Includes a mobile device frame view as well as a full-screen toggle.

## 🚀 How to Run

1. Simply double-click `start.bat` inside `D:\Projects\ios-reminder-app\`.
2. Or open `D:\Projects\ios-reminder-app\index.html` directly in any web browser (Chrome, Edge, Firefox, Safari).
