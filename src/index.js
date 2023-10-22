(function menuListener() {
  const openButton = document.getElementById("open-menu-btn");
  const closeButton = document.getElementById("close-menu-btn");
  const navElem = document.getElementById("nav");
  openButton.addEventListener("click", (e) => {
    navElem.classList.add("show-menu");
  });
  closeButton.addEventListener("click", () => {
    navElem.classList.remove("show-menu");
  });
})();
