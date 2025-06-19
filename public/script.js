// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get the patient form if it exists on the page
    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        console.log('Patient form found');
        patientForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Patient form submitted');
            
            // Get form data
            const formData = {
                name: document.getElementById('name').value,
                address: document.getElementById('address').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                problem: document.getElementById('problem').value
            };

            console.log('Form data:', formData);

            // Store the data temporarily in sessionStorage for the next page
            sessionStorage.setItem('patientData', JSON.stringify(formData));
            console.log('Data stored in sessionStorage');

            // Redirect to appointment page
            console.log('Redirecting to appointment.html');
            window.location.href = 'appointment.html';
        });
    } else {
        console.log('Patient form not found');
    }

    // Get the appointment form if it exists on the page
    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        console.log('Appointment form found');
        
        // Set minimum date to today
        const dateInput = document.getElementById('date');
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;

        // Add event listener for department change
        const departmentSelect = document.getElementById('department');
        const dentistSelect = document.getElementById('dentist');

        departmentSelect.addEventListener('change', function() {
            console.log('Department selected:', this.value);
            const departmentId = this.value;
            
            // Clear current dentist options
            dentistSelect.innerHTML = '<option value="">Choose a dentist</option>';
            
            if (departmentId) {
                console.log('Fetching dentists for department:', departmentId);
                
                // Fetch dentists for selected department from server
                fetch(`api/dentists?department=${departmentId}`)
                    .then(response => {
                        console.log('Response status:', response.status);
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(dentists => {
                        console.log('Dentists received:', dentists);
                        if (dentists && dentists.length > 0) {
                            dentists.forEach(dentist => {
                                const option = document.createElement('option');
                                option.value = dentist.doctor_id;
                                option.textContent = dentist.name;
                                dentistSelect.appendChild(option);
                                console.log('Added dentist option:', dentist.name, 'with ID:', dentist.doctor_id);
                            });
                        } else {
                            console.log('No dentists found for department:', departmentId);
                            dentistSelect.innerHTML = '<option value="">No dentists available</option>';
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching dentists:', error);
                        dentistSelect.innerHTML = '<option value="">Error loading dentists</option>';
                        alert('Error loading dentists. Please try again.');
                    });
            } else {
                console.log('No department selected, clearing dentist options');
            }
        });

        appointmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Appointment form submitted');

            // Get the stored patient data
            const patientData = JSON.parse(sessionStorage.getItem('patientData'));
            if (!patientData) {
                alert('Please fill out patient information first!');
                window.location.href = '/';
                return;
            }

            // Get appointment data
            const appointmentData = {
                ...patientData,
                dentist: document.getElementById('dentist').value,
                department: document.getElementById('department').value,
                date: document.getElementById('date').value,
                time: document.getElementById('time').value
            };

            console.log('Complete appointment data:', appointmentData);

            // Send data to server
            fetch('submit-appointment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appointmentData)
            })
            .then(async response => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const message = data.error || 'Network response was not ok';
                    throw new Error(message);
                }
                return data;
            })
            .then(data => {
                if (data.success) {
                    alert('Appointment booked successfully!');
                    // Clear stored data
                    sessionStorage.removeItem('patientData');
                    // Redirect to home page
                    window.location.href = '/';
                } else {
                    alert('Error booking appointment: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error booking appointment. Please try again.');
            });
        });
    } else {
        console.log('Appointment form not found');
    }
});
