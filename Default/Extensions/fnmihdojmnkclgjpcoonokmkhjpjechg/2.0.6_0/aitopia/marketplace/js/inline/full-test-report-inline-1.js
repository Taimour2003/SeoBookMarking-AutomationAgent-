document.querySelectorAll('.collapsible').forEach(el => {
            el.addEventListener('click', () => {
                const content = el.nextElementSibling;
                content.classList.toggle('expanded');
            });
        });