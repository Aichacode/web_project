const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'ayeshadhan1@gmail.com',
        pass: process.env.EMAIL_PASS || 'uzjf fifw frmb dodp'
    }
});

// Function to send appointment confirmation email
const sendAppointmentConfirmation = async (appointmentDetails) => {
    const {
        patientName,
        patientEmail,
        appointmentDate,
        appointmentTime,
        doctorName,
        departmentName,
        problem
    } = appointmentDetails;

    // Format the date
    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Format the time
    const [hours, minutes] = appointmentTime.split(':');
    const formattedTime = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    // Email content
    const mailOptions = {
        from: 'ayeshadhan1@gmail.com', // Replace with your Gmail address
        to: patientEmail,
        subject: 'Dental Appointment Confirmation',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #17679d; text-align: center;">Appointment Confirmation</h2>
                
                <p>Dear ${patientName},</p>
                
                <p>Your dental appointment has been successfully scheduled. Here are your appointment details:</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Date:</strong> ${formattedDate}</p>
                    <p><strong>Time:</strong> ${formattedTime}</p>
                    <p><strong>Doctor:</strong> ${doctorName}</p>
                    <p><strong>Department:</strong> ${departmentName}</p>
                    <p><strong>Problem Description:</strong> ${problem}</p>
                </div>
                
                <p><strong>Important Notes:</strong></p>
                <ul>
                    <li>Please arrive 10 minutes before your scheduled appointment time</li>
                    <li>Bring any relevant medical records or X-rays if available</li>
                    <li>If you need to reschedule, please call us at least 24 hours in advance</li>
                </ul>
                
                <p style="color: #666; font-size: 14px;">If you have any questions, please don't hesitate to contact us.</p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
                </div>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

// Function to send appointment rescheduled email
const sendAppointmentRescheduled = async (details) => {
    const {
        patientName,
        patientEmail,
        appointmentDate,
        appointmentTime,
        doctorName,
        departmentName
    } = details;

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const [hours, minutes] = appointmentTime.split(':');
    const formattedTime = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const mailOptions = {
        from: 'ayeshadhan1@gmail.com',
        to: patientEmail,
        subject: 'Dental Appointment Rescheduled',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #17679d; text-align: center;">Appointment Rescheduled</h2>
                <p>Dear ${patientName},</p>
                <p>Your appointment has been rescheduled. The new details are:</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Date:</strong> ${formattedDate}</p>
                    <p><strong>Time:</strong> ${formattedTime}</p>
                    <p><strong>Doctor:</strong> ${doctorName}</p>
                    <p><strong>Department:</strong> ${departmentName}</p>
                </div>
            </div>`
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (err) {
        console.error('Error sending reschedule email:', err);
        return false;
    }
};

// Function to send appointment cancellation email
const sendAppointmentCancellation = async (details) => {
    const {
        patientName,
        patientEmail,
        appointmentDate,
        appointmentTime,
        doctorName,
        departmentName
    } = details;

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const [hours, minutes] = appointmentTime.split(':');
    const formattedTime = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const mailOptions = {
        from: 'ayeshadhan1@gmail.com',
        to: patientEmail,
        subject: 'Dental Appointment Cancelled',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #17679d; text-align: center;">Appointment Cancelled</h2>
                <p>Dear ${patientName},</p>
                <p>Your appointment on ${formattedDate} at ${formattedTime} with ${doctorName} in ${departmentName} has been cancelled.</p>
            </div>`
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (err) {
        console.error('Error sending cancellation email:', err);
        return false;
    }
};
module.exports = {
     sendAppointmentConfirmation,
    sendAppointmentRescheduled,
    sendAppointmentCancellation
};
