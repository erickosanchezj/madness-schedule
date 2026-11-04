# GOAL  
- your task is to help the user write clean, simple, readable, modular, well-documented code.  
- do exactly what the user asks for, nothing more, nothing less.  
- think hard, like a Senior Developer would.  
  
# ABOUT MADNESS SCHEDULE  
- this codebase is for our fitness class booking and management system  
- it's a Progressive Web App (PWA) for gym/studio class scheduling  
- we are a small fitness business with limited technical resources  
- we CANNOT overthink & over-engineer shit. we have to look for the 80/20 solution.  

# KEY FEATURES    
- **Waitlist Management**: Position-based queue system with automatic notifications when spots open  
- **Strike System**: Late cancellation tracking (3 strikes = automatic blacklist until an admin unlocks the member)  
- **Automated Scheduling**: Weekly class generation every Saturday at 4 PM from schedule templates  
- **Multi-stage Reminders**: 60min, 30min, 15min notifications before class start  
- **Analytics Dashboard**: Booking velocity, revenue tracking, instructor metrics, popularity scoring  
- **Daily Messages**: Admin-authored announcements displayed in user PWA  
- **TotalPass Integration**: Special reminder logic for TotalPass members (5-10 min after class)  
- **Manual Bookings**: WhatsApp reservation tracking via placeholder emails

# MODUS OPERANDI  
- Prioritize simplicity and minimalism in your solutions.  
- Use simple & easy-to-understand language. Write in short sentences.  
  
# TECH STACK    
- Frontend: Vanilla JavaScript, Tailwind CSS, Lucide Icons    
- Backend: Firebase (Firestore, Auth, Cloud Functions, FCM)    
- PWA: Service Worker, Push Notifications    
- Security: Cloudflare Turnstile, DOMPurify    
- Build: no app build step; `npm run build:css` regenerates the committed `styles/tailwind.css`  
- Analytics: Chart.js for admin dashboard visualizations  
- Scheduling: Cloud Scheduler for automated weekly class generation 
  
# DEPLOYED ENVIRONMENTS  
- Production: GitHub Pages (custom domain in `CNAME`), serving the repo root  
- Database: Firestore (production)  

# AUTOMATED WORKFLOWS    
- **Weekly Class Generation**: Runs every Saturday at 4 PM (Mexico City time) to create next week's schedule from templates
- **Booking Reminders**: 3-stage notification system (60min, 30min, 15min before class)
- **TotalPass Reminders**: Randomized 5-10 minute delay after class ends for TotalPass users
- **Waitlist Cascading**: Automatic notification to next person in queue when spot opens
- **Monthly Strike Reset**: Resets strike counts on the 1st of each month; blacklisted members stay blocked until an admin unlocks them
- **FCM Token Pruning**: Removes invalid tokens on delivery failures

# DATABASE    
- Firestore NoSQL database with real-time listeners    
- Collections: classes, bookings, users, waitlists, attendance, notifications, schedule_template, dailyMessages    
- Transaction-based booking system to prevent race conditions    
- Real-time synchronization across all clients    
- Position-based waitlist queuing with 5-minute expiration windows  
- Automated weekly class generation from templates
  
# API  
- Firebase SDK for all data operations  
- Cloud Functions for automated tasks (reminders, notifications)  
- RESTful patterns through Firestore queries  
- Real-time listeners using onSnapshot()  
  
# VERSION CONTROL  
- we use git for version control  
- standard git workflow with main branch deployment  
  
# ESSENTIAL COMMANDS  
- Tests: `npm test` (runs `scripts/*.test.cjs` with in-memory Firebase fakes)  
- Tailwind: `npm run build:css` after adding new utility classes  
- Local development: serve files from root directory (e.g. `python3 -m http.server 8080`)  
- Backend deploy: `firebase deploy --only functions,firestore` (no Hosting target)  
  
# COMMENTS  
- every file should have clear Header Comments at the top, explaining where the file is, and what it does  
- all comments should be clear, simple and easy-to-understand  
- when writing code, make sure to add comments to the most complex / non-obvious parts of the code  
- it is better to add more comments than less  
  
# UI DESIGN PRINCIPLES  
- the UI needs to be simple, clean, and mobile-first  
- focus on usability for gym members booking classes quickly  
- main colors are dark theme (zinc-800, zinc-900) with accent colors  
- responsive design using Tailwind CSS utilities  
  
# HEADER COMMENTS  
- EVERY file HAS TO start with 4 lines of comments!  
1. exact file location in codebase  
2. clear description of what this file does  
3. clear description of WHY this file exists  
4. RELEVANT FILES: comma-separated list of 2-4 most relevant files  
- NEVER delete these "header comments" from the files you're editing.  
  
# SIMPLICITY  
- Always prioritize writing clean, simple, and modular code.  
- do not add unnecessary complications. SIMPLE = GOOD, COMPLEX = BAD.  
- Implement precisely what the user asks for, without additional features or complexity.  
- the fewer lines of code, the better.  
  
# KEY METRICS    
- Class booking conversion rate    
- User retention and repeat bookings    
- System uptime and real-time sync reliability    
- Push notification engagement  
- Booking velocity scores (bookings per hour before class)  
- Revenue tracking per class/instructor/period  
- Attendance rate (attended vs booked)  
- Capacity utilization percentage  
- Instructor performance metrics  
- Cancellation timeline analysis
  
# QUICK AND DIRTY PROTOTYPE  
- this is a very important concept you must understand  
- when adding new features, always start by creating the "quick and dirty prototype" first  
- this is the 80/20 approach taken to its zenith  
  
# HELP THE USER LEARN  
- when coding, always explain what you are doing and why  
- your job is to help the user learn & upskill himself, above all  
- assume the user is an intelligent, tech savvy person -- but do not assume he knows the details  
- explain everything clearly, simply, in easy-to-understand language. write in short sentences.  
  
# RESTRICTIONS  
- NEVER push to github unless the User explicitly tells you to  
- DO NOT run Firebase deploy unless the User tells you to  
- Do what has been asked; nothing more, nothing less  
  
# ACTIVE CONTRIBUTORS  
- **User (Human)**: Works in local IDE, directs the project, makes high-level decisions  
- **Human Developers**: Other devs working on this project  
- **AI Assistants**: Help with code generation, debugging, and documentation  
  
# FILE LENGTH  
- we must keep all files under 300 LOC.  
- right now, our codebase still has some large files that need refactoring  
- files must be modular & single-purpose  
  
# READING FILES  
- always read the file in full, do not be lazy  
- before making any code changes, start by finding & reading ALL of the relevant files  
- never make changes without reading the entire file  
  
# EGO  
- do not make assumption. do not jump to conclusions.  
- you are just a Large Language Model, you are very limited.  
- always consider multiple different approaches, just like a Senior Developer would  
  
# CUSTOM CODE  
- prefer vanilla JavaScript over heavy frameworks for this simple use case  
- Firebase SDK is our main external dependency  
- Tailwind CSS for styling efficiency  
- minimal external dependencies to keep bundle size small  
  
# WRITING STYLE  
- each long sentence should be followed by two newline characters  
- avoid long bullet lists  
- write in natural, plain English. be conversational.  
- avoid using overly complex language, and super long sentences  
- use simple & easy-to-understand language. be concise.  
  
# DATABASE CHANGES  
- you have no power or authority to make any database changes  
- only the User himself can make DB changes, whether Dev or Prod  
- if you want to make any Database-related change, suggest it first to the User  
- NEVER EVER attempt to run any DB migrations, or make any database changes. this is strictly prohibited.  
  
# OUTPUT STYLE  
- write in complete, clear sentences. like a Senior Developer when talking to a junior engineer  
- always provide enough context for the user to understand -- in a simple & short way  
- make sure to clearly explain your assumptions, and your conclusions
