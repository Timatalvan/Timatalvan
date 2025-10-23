# Tímatalva

A simple and lightweight timetable viewer for WebUntis, designed for Windows. This application provides a clean, fast, and native-like experience for checking your daily schedule from Vinnuháskúlin í Tórshavn.

## Features

- **Fast Loading:** Caches data to provide a snappy experience, even when the server is slow.
- **Multiple Views:** View timetables for multiple classes or teachers at once.
- **Minimalist UI:** A clean and focused interface that shows you exactly what you need.
- **System Tray Integration:** Runs quietly in the system tray for quick access.
- **Desktop Notifications:** Get reminders for upcoming lessons and breaks.

## Installation

To get started, you need to have [Node.js](https://nodejs.org/) installed.

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/timatalva-vh-webuntis.git
    cd timatalva-vh-webuntis
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

## Usage

To run the application in development mode:

```sh
npm start
```

This will launch the application window.

## Configuration

The application uses a `.env` file in the root directory to configure the WebUntis server and school name. An example is provided in the repository.

```
UNTIS_SCHOOL="Vinnuhaskulin Torshavn"
UNTIS_SERVER="hektor.webuntis.com"
```

You can also set the default classes or teachers to display by modifying the `untis.elements` key in the application's settings file, which is managed by `electron-store`.

## Building the Application

To build a distributable installer for Windows, run the following command:

```sh
npm run build
```

The installer will be located in the `dist` directory.
