# Dental Appointment System

A web-based dental appointment scheduling system built with Node.js, Express, and Supabase.

## Features

- Patient appointment booking
- Dentist login and dashboard
- Appointment management
- Email confirmations
- Real-time data with Supabase

## Setup for Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd dental-appointment-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `env.example` to `.env`
   - Fill in your Supabase credentials:
     ```
     SUPABASE_URL=your_supabase_project_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     JWT_SECRET=your_jwt_secret
     ```

4. **Set up Supabase Database**
   - Create a new project in Supabase
   - Run the SQL from `database.sql` in your Supabase SQL editor
   - Get your project URL and anon key from Settings > API

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Deployment to Vercel

1. **Install Vercel CLI** (optional)
   ```bash
   npm i -g vercel
   ```

2. **Set up environment variables in Vercel**
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add the following variables:
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_ANON_KEY`: Your Supabase anon key
     - `JWT_SECRET`: Your JWT secret key

3. **Deploy**
   ```bash
   vercel --prod
   ```
   Or connect your GitHub repository to Vercel for automatic deployments.

## Database Schema

The application uses the following tables in Supabase:
- `patients`: Patient information
- `doctors`: Doctor information
- `departments`: Department information
- `appointments`: Appointment records
- `dentist_login`: Dentist login credentials

## API Endpoints

- `POST /api/dentist-login`: Dentist authentication
- `GET /api/appointments`: Get appointments (requires auth)
- `GET /api/dentists`: Get dentists by department
- `POST /submit-appointment`: Submit new appointment

## Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: Server port (default: 3000)

## Security Notes

- Change the JWT_SECRET in production
- Use environment variables for all sensitive data
- Consider implementing password hashing for dentist accounts
- Set up proper CORS policies for production #   w e b _ p r o j e c t  
 