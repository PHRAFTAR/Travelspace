// mobile-nav.js

document.addEventListener("DOMContentLoaded", function() {
    const menuIcon = document.querySelector(".menu-icon");
    const navList = document.querySelector(".nav-list");
    const navLinks = document.querySelectorAll(".nav-list li a");
    const headerTitle = document.querySelector("header h1"); // Select the header title
    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("img01");
    const images = document.querySelectorAll(".modal-image");
    const span = document.getElementsByClassName("close")[0];

    // Toggle mobile menu visibility
    menuIcon.addEventListener("click", function() {
        navList.classList.toggle("active");
    });

    // Close mobile menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener("click", function() {
            navList.classList.remove("active");
        });
    });

    // Image modal functionality
    images.forEach((img) => {
        img.addEventListener("click", () => {
            modal.style.display = "flex";
            modalImg.src = img.src;
        });
    });

    // Close the modal when clicking on the close button
    if (span) {
        span.onclick = () => {
            modal.style.display = "none";
        };
    }

    // Close mobile menu and modal when clicking outside of them
    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        } else if (!navList.contains(event.target) && !menuIcon.contains(event.target) && navList.classList.contains("active")) {
            navList.classList.remove("active");
        }
    });

    // Redirect to homepage when the header title is clicked
    if (headerTitle) {
        headerTitle.addEventListener("click", () => {
            window.location.href = "index.html";
        });
    }
});
