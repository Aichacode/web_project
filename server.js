const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const supabase = require('./supabase');
const { sendAppointmentConfirmation } = require('./emailconfig');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'wy4Wy3RnuIy1BOQetL8Gty4WO7yAA3XYV3DWmA4GJyvtQFzJoCGdjZCCG2y7HMXQwSAhIzRxYMR7aWduc3IbIQ==';

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

// dentist login
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
                dentists!inner(
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

            // Create JWT token with dentist role
            const token = jwt.sign(
                { 
                    id: dentist.dentists.doctor_id,
                    username: dentist.username,
                    name: dentist.dentists.name,
                    role: 'dentist'
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: dentist.dentists.doctor_id,
                    username: dentist.username,
                    name: dentist.dentists.name
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

// get appointments with filters
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
                dentists!inner(
                    name
                )
            `);

        // Restrict results based on user role
        if (req.user.role === 'dentist') {
            query = query.eq('doctor_id', req.user.id);
        } else if (req.user.role !== 'frontdesk') {
            return res.status(403).json({ error: 'Forbidden' });
        }

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
            doctor_name: apt.dentists.name,
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

// get dentists by department
app.get('/api/dentists', async (req, res) => {
    const { department } = req.query;
    
    if (!department) {
        res.status(400).json({ error: 'Department ID is required' });
        return;
    }

    try {
        const { data: dentists, error } = await supabase
            .from('dentists')
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

// get booked slots for a dentist on a specific date
app.get('/api/booked-slots', async (req, res) => {
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
        res.status(400).json({ error: 'doctor_id and date are required' });
        return;
    }

    try {
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('time_slot')
            .eq('doctor_id', doctor_id)
            .eq('appointment_date', date);

        if (error) {
            console.error('Error fetching booked slots:', error);
            res.status(500).json({ error: 'Failed to fetch booked slots' });
            return;
        }

        const booked = appointments.map(appt => appt.time_slot);
        res.json(booked);
    } catch (error) {
        console.error('Error in booked slots endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch booked slots' });
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

    console.log('Appointment submission received:', { name, email, dentist, department, date, time });

    // Validate required fields
    if (!name || !email || !phone || !dentist || !department || !date || !time) {
        console.error('Missing required fields');
        res.status(400).json({ success: false, error: 'All fields are required' });
        return;
    }

    try {
        // insert the patient first
        const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .insert([{
                name: name,
                address: address || '',
                email: email,
                phone: phone
            }])
            .select();

        if (patientError) {
            console.error('Error saving patient:', patientError);
            res.status(500).json({ success: false, error: 'Failed to save patient information' });
            return;
        }

        const patientId = patientData[0].id;
        console.log('Patient saved with ID:', patientId);

        // Get the doctor's information
        const { data: doctorData, error: doctorError } = await supabase
            .from('dentists')
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
             res.status(500).json({ success: false, error: 'Failed to find doctor' });
            return;
        }
        
        if (!doctorData || doctorData.length === 0) {
            console.error('No doctor found with ID:', dentist);
            res.status(404).json({ success: false, error: `Doctor with ID ${dentist} not found` });
            return;
        }

        const doctorId = doctorData[0].doctor_id;
        const doctorName = doctorData[0].name;
        const departmentName = doctorData[0].departments.name;
         console.log('Found doctor:', doctorName, 'in department:', departmentName);
       
        // check if the selected time slot is already booked
        const { data: existing, error: existingError } = await supabase
            .from('appointments')
            .select('id')
            .eq('doctor_id', doctorId)
            .eq('appointment_date', date)
            .eq('time_slot', time);

        if (existingError) {
            console.error('Error checking existing appointment:', existingError);
            res.status(500).json({ success: false, error: 'Failed to check appointment availability' });
            return;
        }

        if (existing && existing.length > 0) {
            res.status(409).json({ success: false, error: 'Selected time slot is already booked' });
            return;
        }

        // insert the appointment
        const { data: appointmentData, error: appointmentError } = await supabase
            .from('appointments')
            .insert([{
                patient_id: patientId,
                department_id: department,
                doctor_id: doctorId,
                appointment_date: date,
                time_slot: time,
                problem: problem || ''
            }])
            .select();

        if (appointmentError) {
            console.error('Error saving appointment:', appointmentError);
             res.status(500).json({ success: false, error: 'Failed to save appointment' });
            return;
        }

         console.log('Appointment saved with ID:', appointmentData[0].id);

        // Send confirmation email (optional)
        try {
            const appointmentDetails = {
                patientName: name,
                patientEmail: email,
                appointmentDate: date,
                appointmentTime: time,
                doctorName: doctorName,
                departmentName: departmentName,
                problem: problem
            };
        
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
            message: 'Appointment booked successfully!'
        });

    } catch (error) {
        console.error('Error in appointment submission:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Page Routes - Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/appointment.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'appointment.html'));
});

app.get('/dentist-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dentist-dashboard.html'));
});

app.get('/dentist-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dentist-login.html'));
});

// Start the server
app.listen(port, () => {
    console.log('Static files served from: public/');
}); 
