
(function () {
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackBtn = document.getElementById('feedback-btn');
    const closeFeedbackBtn = document.getElementById('close-feedback-btn');

    const fbName = document.getElementById('fb-name');
    const fbContact = document.getElementById('fb-contact');
    const fbComments = document.getElementById('fb-comments');

    function init() {
        const triggers = [
            document.getElementById('feedback-btn'),
            document.getElementById('landing-feedback-btn')
        ].filter(el => el !== null);

        if (triggers.length === 0) return;

        triggers.forEach(btn => {
            btn.addEventListener('click', () => {
                feedbackModal.classList.remove('hidden');
            });
        });

        closeFeedbackBtn.addEventListener('click', () => {
            feedbackModal.classList.add('hidden');
        });

        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const comments = fbComments.value.trim();
            if (!comments) {
                alert("Please provide at least a short comment!");
                return;
            }

            const rating = document.querySelector('input[name="rating"]:checked')?.value || 5;

            const payload = {
                name: fbName.value.trim(),
                email_or_contact: fbContact.value.trim(),
                rating: parseInt(rating),
                comments: comments
            };

            try {
                const response = await fetch('/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok) {
                    alert(result.message || "Thank you for your feedback!");
                    feedbackForm.reset();
                    feedbackModal.classList.add('hidden');
                } else {
                    alert("Error: " + (result.error || "Submission failed."));
                }
            } catch (err) {
                console.error("Feedback Submission Error:", err);
                alert("Failed to connect to server. Check your connection.");
            }
        });
    }

    // Modal Close on backdrop click
    feedbackModal.addEventListener('click', (e) => {
        if (e.target === feedbackModal) {
            feedbackModal.classList.add('hidden');
        }
    });

    init();
})();
