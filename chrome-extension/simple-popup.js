// Simple test without complex dependencies
alert('SIMPLE: Extension is loading!');
console.log('SIMPLE: Extension is loading!');

document.addEventListener('DOMContentLoaded', function() {
    alert('SIMPLE: DOM loaded!');
    console.log('SIMPLE: DOM loaded!');
    
    // Get the form elements
    const vaultBtn = document.getElementById('vaultBtn');
    const companyInput = document.getElementById('company');
    const userInput = document.getElementById('user');
    
    if (vaultBtn) {
        vaultBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert('SIMPLE: Button clicked! Company: ' + companyInput.value + ', User: ' + userInput.value);
            console.log('SIMPLE: Button clicked!', { company: companyInput.value, user: userInput.value });
            
            // Simple fetch test
            fetch('http://proofvault.net:3003/api/health')
                .then(response => {
                    alert('SIMPLE: API responded with status ' + response.status);
                    console.log('SIMPLE: API response:', response);
                    return response.json();
                })
                .then(data => {
                    alert('SIMPLE: API data received: ' + JSON.stringify(data));
                    console.log('SIMPLE: API data:', data);
                })
                .catch(error => {
                    alert('SIMPLE: API error: ' + error.message);
                    console.error('SIMPLE: API error:', error);
                });
        });
    }
});