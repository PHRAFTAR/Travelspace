document.addEventListener('DOMContentLoaded', () => {
    const banner = document.querySelector('.banner');
    const images = [
        'folder1 images/20240721_184742.jpg',
        'folder1 images/20240721_191831.jpg',
        'folder1 images/20240721_185346 (1).jpg',
        'folder1 images/20240721_185249 (1).jpg',
    ];
    let currentIndex = 0;

    function changeBannerImage() {
        currentIndex = (currentIndex + 1) % images.length;
        banner.style.backgroundImage = `url('${images[currentIndex]}')`;
    }

    setInterval(changeBannerImage, 3000); // Change image every 5 seconds
});
