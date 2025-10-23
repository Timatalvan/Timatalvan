# Tímatalva 
*A sleek, native timetable viewer for WebUntis on Windows.*

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows-informational.svg)](#)

A lightweight and fast timetable viewer for WebUntis, designed for a focused experience. Built for students and teachers at Vinnuháskúlin í Tórshavn, it runs quietly in your system tray and provides helpful notifications to keep you on schedule.

<p align="center">
  <!-- TODO: Add a screenshot of the application -->
  <!-- <img src="assets/screenshot.png" alt="Application Screenshot" width="600"/> -->
</p>

---

## Features

-   **🚀 Fast & Responsive:** Caches timetable data to provide a snappy experience, even when the server is slow.
-   **👀 Multi-Element View:** Combine timetables for multiple classes or teachers into a single view.
-   **✨ Clean Interface:** A minimalist UI that focuses on what's important: your schedule.
-   **🪟 System Tray Integration:** Runs quietly in the background and is always just a click away.
-   **🔔 Desktop Notifications:** Get automatic reminders for upcoming lessons and scheduled breaks.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

### Installation

1.  Clone the repository to your local machine.
    ```sh
    git clone https://github.com/your-username/timatalva-vh-webuntis.git
    cd timatalva-vh-webuntis
    ```
2.  Install the necessary NPM packages.
    ```sh
    npm install
    ```

## Usage

To run the application in development mode, execute the following command:

```sh
npm start
```

The application window will appear, and an icon will be added to your system tray.

## Building the Application

To build a distributable installer for Windows (`.exe`), run the following command:

```sh
npm run build
```

The installer will be created in the `dist` directory.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
