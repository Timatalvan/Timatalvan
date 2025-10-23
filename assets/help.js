document.addEventListener("DOMContentLoaded", () => {
  const showImgBtn = document.getElementById("showImgBtn");
  const imgBox = document.getElementById("imgBox");

  if (showImgBtn && imgBox) {
    showImgBtn.addEventListener("click", () => {
      const isHidden = imgBox.style.display === "none";
      imgBox.style.display = isHidden ? "block" : "none";

      // If we are showing the box, find any images inside that have a data-src
      // and set their src to trigger the load.
      if (isHidden) {
        const images = imgBox.querySelectorAll("img[data-src]");
        images.forEach(img => {
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
        });
      }
    });
  }
});
