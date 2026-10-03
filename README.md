# Todo Pro

A full-stack to-do web app built with Node.js, Express, EJS and MongoDB.

## Features

- Sign up, log in and log out
- Password reset with a one-time code sent by email
- Add, edit, delete and complete tasks
- Priority, category, due date and notes on every task
- Search, filter and sort tasks
- Overdue tracking and a progress bar
- Welcome email and daily due-task reminders
- Dark mode

## Tech stack

- **Backend:** Node.js, Express
- **Views:** EJS
- **Database:** MongoDB with Mongoose
- **Email:** Nodemailer
- **Security:** bcrypt, Helmet, CSRF protection, rate limiting

## Getting started

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/<your-username>/todo-pro.git
   cd todo-pro
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your own values.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Project structure

```
todo-pro/
├── server.js
├── models/        # Mongoose schemas
├── routes/        # Auth, password reset, tasks
├── middleware/    # Auth guards
├── utils/         # Mailer and reminders
├── views/         # EJS templates
└── public/        # CSS and client JS
```

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Run the app |
| `npm run dev` | Run with auto-restart (nodemon) |
