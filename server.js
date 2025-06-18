const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const supabase = require('./supabase');
const { sendAppointmentConfirmation } = require('./emailconfig');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files first (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// API Routes
app.post('/api/dentist-login', async (req, res) => {
    const { username, password } = req.body;

    console.log('Login attempt for username:', username);

    if (!username || !password) {
        console.log('Missing username or password');
        return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    try {
        // Query Supabase for the dentist with case-insensitive username
        const { data: dentists, error } = await supabase
            .from('dentist_login')
            .select(`
                *,
                doctors!inner(
                    name,
                    doctor_id
                )
            `)
            .ilike('username', username);

        if (error) {
            console.error('Supabase error during login query:', error);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        if (dentists.length === 0) {
            console.log('Login attempt failed: username not found in DB for:', username);
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        const dentist = dentists[0];
        console.log('Found dentist in DB:', dentist.username);

        // For now, we're using plain text comparison since passwords are stored as plain text
        // In production, you should use bcrypt.compare() with hashed passwords
        if (password === dentist.password) {
            console.log('Password matched for:', dentist.username);
            // Create JWT token
            const token = jwt.sign(
                { 
                    id: dentist.doctors.doctor_id,
                    username: dentist.username,
                    name: dentist.doctors.name
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: dentist.doctors.doctor_id,
                    username: dentist.username,
                    name: dentist.doctors.name
                }
            });
        } else {
            console.log('Login attempt failed: incorrect password for:', username);
            res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// API endpoint to get appointments with filters
app.get('/api/appointments', authenticateToken, async (req, res) => {
    const { department, date, dateFilter } = req.query;
    
    try {
        let query = supabase
            .from('appointments')
            .select(`
                id,
                patient_id,
                appointment_date,
                time_slot,
                problem,
                patients!inner(
                    name,
                    phone,
                    email
                ),
                departments!inner(
                    name
                ),
                doctors!inner(
                    name
                )
            `);

        // Add department filter
        if (department) {
            query = query.eq('department_id', department);
        }

        // Add date filters
        if (date) {
            query = query.eq('appointment_date', date);
        } else if (dateFilter) {
            const today = new Date().toISOString().split('T')[0];
            switch (dateFilter) {
                case 'today':
                    query = query.eq('appointment_date', today);
                    break;
                case 'tomorrow':
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    query = query.eq('appointment_date', tomorrow.toISOString().split('T')[0]);
                    break;
                case 'week':
                    const weekFromNow = new Date();
                    weekFromNow.setDate(weekFromNow.getDate() + 7);
                    query = query
                        .gte('appointment_date', today)
                        .lte('appointment_date', weekFromNow.toISOString().split('T')[0]);
                    break;
            }
        }

        // Order by date and time
        query = query.order('appointment_date', { ascending: true })
                    .order('time_slot', { ascending: true });

        const { data: appointments, error } = await query;

        if (error) {
            console.error('Error fetching appointments:', error);
            res.status(500).json({ error: 'Failed to fetch appointments' });
            return;
        }

        // Transform the data to match the expected format
        const transformedAppointments = appointments.map(apt => ({
            id: apt.id,
            patient_id: apt.patient_id,
            appointment_date: apt.appointment_date,
            time_slot: apt.time_slot,
            patient_name: apt.patients.name,
            department_name: apt.departments.name,
            doctor_name: apt.doctors.name,
            phone: apt.patients.phone,
            email: apt.patients.email,
            problem: apt.problem
        }));

        res.json(transformedAppointments);
    } catch (error) {
        console.error('Error in appointments endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// API endpoint to get dentists by department
app.get('/api/dentists', async (req, res) => {
    const { department } = req.query;
    
    if (!department) {
        res.status(400).json({ error: 'Department ID is required' });
        return;
    }

    try {
        const { data: dentists, error } = await supabase
            .from('doctors')
            .select('doctor_id, name')
            .eq('department_id', department)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching dentists:', error);
            res.status(500).json({ error: 'Failed to fetch dentists' });
            return;
        }

        res.json(dentists);
    } catch (error) {
        console.error('Error in dentists endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch dentists' });
    }
});

// Handle appointment submission
app.post('/submit-appointment', async (req, res) => {
    const {
        name,
        address,
        email,
        phone,
        problem,
        dentist,
        department,
        date,
        time
    } = req.body;

    // Debug logging
    console.log('Full request body:', req.body);
    console.log('Dentist value received:', dentist);
    console.log('Department value received:', department);

    // Validate dentist ID
    if (!dentist) {
        console.error('Dentist ID is missing or invalid:', dentist);
        res.json({ success: false, error: 'Dentist selection is required.' });
        return;
    }

    try {
        // First, let's check what doctors we have in the database
        const { data: allDoctors, error: doctorsError } = await supabase
            .from('doctors')
            .select('*')
            .eq('doctor_id', dentist);

        if (doctorsError) {
            console.error('Error fetching doctors:', doctorsError);
        } else {
            console.log('Current doctors in database:', allDoctors);
        }

        // First, insert the patient
        const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .insert([{
                name: name,
                address: address,
                email: email,
                phone: phone
            }])
            .select();

        if (patientError) {
            console.error('Error saving patient:', patientError);
            res.json({ success: false, error: 'Failed to save patient information' });
            return;
        }

        const patientId = patientData[0].id;

        // Get the doctor's ID and name
        const { data: doctorData, error: doctorError } = await supabase
            .from('doctors')
            .select(`
                doctor_id,
                name,
                departments!inner(
                    name
                )
            `)
            .eq('doctor_id', dentist);

        if (doctorError) {
            console.error('Error finding doctor:', doctorError);
            res.json({ success: false, error: 'Failed to find doctor' });
            return;
        }
        
        if (!doctorData || doctorData.length === 0) {
            console.error('No doctor found with ID:', dentist);
            res.json({ success: false, error: `Doctor with ID ${dentist} not found in database` });
            return;
        }

        const doctorId = doctorData[0].doctor_id;
        const doctorName = doctorData[0].name;
        const departmentName = doctorData[0].departments.name;
        console.log('Found doctor ID:', doctorId);

        // Then, insert the appointment
        const { data: appointmentData, error: appointmentError } = await supabase
            .from('appointments')
            .insert([{
                patient_id: patientId,
                department_id: department,
                doctor_id: doctorId,
                appointment_date: date,
                time_slot: time,
                problem: problem
            }])
            .select();

        if (appointmentError) {
            console.error('Error saving appointment:', appointmentError);
            res.json({ success: false, error: 'Failed to save appointment' });
            return;
        }

        // Prepare appointment details for email
        const appointmentDetails = {
            patientName: name,
            patientEmail: email,
            appointmentDate: date,
            appointmentTime: time,
            doctorName: doctorName,
            departmentName: departmentName,
            problem: problem
        };

        // Send confirmation email
        try {
            const emailSent = await sendAppointmentConfirmation(appointmentDetails);
            if (!emailSent) {
                console.warn('Failed to send confirmation email, but appointment was saved');
            }
        } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
            // Don't fail the appointment booking if email fails
        }

        res.json({ 
            success: true, 
            appointmentId: appointmentData[0].id,
            emailSent: true
        });

    } catch (error) {
        console.error('Error in appointment submission:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Page Routes - Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/appointment.html', (req, res) => {
    console.log('Serving appointment.html');
    res.sendFile(path.join(__dirname, 'appointment.html'));
});

app.get('/dentist-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dentist-dashboard.html'));
});

app.get('/dentist-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'dentist-login.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 