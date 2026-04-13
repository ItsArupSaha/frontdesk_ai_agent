### How The Whole Product Works — End to End
Let me explain this from the very beginning, like you're telling a story.

## The Big Picture
You built a product that helps small businesses (plumbers, HVAC techs, electricians) answer phone calls automatically using AI. Instead of missing calls at 2am, their AI agent picks up, qualifies the caller, and books appointments.

There are two types of people using this system:

You (Arup) = Admin — You run the SaaS business. You sign up clients, manage them, and monitor everything.
Your clients (e.g. "Joe's Plumbing") = Client — They pay you $150/month. Their customers call their phone number, the AI answers.
Who Is The Admin?
The admin is only you, Arup. There is no self-signup for admin. You manually insert your own row into the admins database table (a one-time thing you do yourself in Supabase).

This is how you add yourself as admin — you go to the Supabase dashboard, open the SQL editor, and run:


INSERT INTO admins (id, email)
VALUES ('your-supabase-auth-uuid', 'arup@youremail.com');
That's it. After that, whenever you log into the frontend, the system detects you're in the admins table and gives you the admin panel instead of the client dashboard.

Who Is A Client?
A client is a business like "Joe's Plumbing." They do NOT sign up themselves. You (the admin) create them through the admin panel. After you create them, they receive an email to set their password, and then they log in to see their own dashboard — call logs, bookings, analytics, settings.

The Admin Panel — What It Does
When you log in as admin, you land on /admin. This panel lets you:

1. See all your clients in a table

Business name, active/suspended status
How many calls this month
How many bookings this month
Estimated monthly cost (so you know what each client is costing you in Vapi + Twilio fees)
2. Suspend or reactivate a client

If a client stops paying, you click "Suspend" — their AI agent stops answering calls immediately
You can reactivate them with one click when they pay again
3. Impersonate a client (view their dashboard)

You click "View Dashboard" next to any client
You see exactly what they see — their calls, bookings, analytics
You stay logged in as admin, you're just viewing their data
A banner shows at the top: "Viewing: Joe's Plumbing — Exit"
4. Create a new client (the onboarding wizard)

You click "Add New Client" → goes to a 7-step wizard
You fill in their business details, and the system automatically:
Creates their login account in Supabase
Buys them a real Twilio phone number
Creates their Vapi AI assistant
Sets up their knowledge base
After this, the client gets an email to set their password
The Client Panel — What It Does
When a client logs in (e.g. Joe from Joe's Plumbing), they land on /dashboard. They can see:

Dashboard — overview metrics: calls today, bookings this week, booking rate
Call Logs — every call the AI answered, with transcript and summary
Bookings — every appointment the AI booked
Analytics — charts showing call volume, peak hours, booking trends
Settings — update their business name, working hours, services, emergency phone number
They cannot see other clients' data. They cannot access /admin. If they try to go to /admin, the system redirects them back to /dashboard.

The Complete Client Signup Flow — Step by Step
Here is exactly what happens when you sign up a new client:

Step 1 — You fill out the 7-step wizard in the admin panel
You enter:

Business name: "Joe's Plumbing"
Email: joe@joesplumbing.com
Emergency phone: +12125550100
Services: Pipe repair, drain cleaning, water heater
Working hours: Mon-Fri 8am-6pm, Sat 9am-3pm
Service area: Brooklyn and Queens, ZIP codes 11201, 11202, etc.
Area code for phone number: 718
FSM software: Jobber (optional, with API key)
Step 2 — You click "Launch Agent"
Behind the scenes, the system does these things automatically, in order:

Step	What happens
1	Validates all your input
2	Creates a Supabase auth account for joe@joesplumbing.com with a random temporary password
3	Stores Joe's business info in the database
4	Creates a Vapi AI assistant configured with Joe's business name, services, working hours
5	Buys a real phone number with area code 718 from Twilio (e.g. +17185550199)
6	Builds Joe's knowledge base so the AI can answer FAQs about his business
7	Returns success with the phone number
Step 3 — Joe gets an email automatically
Supabase sends Joe an email to set his password. The email says something like:
"You've been set up on AI Front-Desk. Click here to set your password."

This is handled by Supabase's built-in password reset flow — you don't write any email-sending code for this. It happens automatically in Step 2.

Step 4 — You tell Joe to forward his calls
After the wizard finishes, the screen shows:

"Agent is live! Forward calls to +17185550199."

You (or Joe) goes into his existing phone provider settings and sets up call forwarding: when calls come in to his business number → forward to +17185550199. That's the Twilio number the AI agent is listening on.

Step 5 — Joe logs in to his dashboard
Joe clicks the link in the email, sets his password, logs in. He sees his own dashboard. His AI is already live and answering calls.

What Happens During A Real Phone Call
When a customer calls Joe's business number, here's what happens:

The call gets forwarded to Joe's Twilio number (+17185550199)
Twilio sends the call to Vapi
Vapi answers the call with Joe's AI assistant
The AI says something like: "Thanks for calling Joe's Plumbing! This is Alex. How can I help you today?"
The customer explains their problem
The AI figures out if it's an emergency (burst pipe, gas leak) → if yes, transfers to Joe's emergency phone immediately
If it's a normal job, the AI qualifies the caller, checks Google Calendar for available slots, and books an appointment
The customer gets an SMS confirmation
If Joe uses Jobber, a job is also created in Jobber automatically
The call and booking appear in Joe's dashboard in real-time
How The Two Logins Are Separated
Both you (admin) and Joe (client) log in through the same login page at /login.

After login, the system calls GET /api/auth/me. This checks: "Is this user's ID in the admins table?"

If yes → is_admin: true → you get redirected to /admin
If no → is_admin: false → you get redirected to /dashboard
Clients can never reach /admin. Admins can reach everything.

Summary In One Sentence Each
Person	Who they are	How they get access	What they see
Admin (you)	The SaaS owner (Arup)	Manually inserted into admins table in Supabase	/admin — all clients, usage stats, onboarding wizard
Client (e.g. Joe)	A paying business	You create them through the admin panel	/dashboard — only their own calls, bookings, analytics
End caller	Joe's customers	They just call a phone number	Nothing — they only interact with the AI voice agent
The one thing to remember: you never share any self-signup link with clients. You create every client yourself through the admin panel. They get an email, they set a password, they log in. That's it.