import {
	initializeI18next,
	updateContent,
	setupLanguageSwitch,
} from "./locales/language.js";
import initializeSwiper from "./swiper/swiper.ts";

initializeI18next().then(() => {
	updateContent();
	setupLanguageSwitch();
});

// Nav open / close
const navElem = document.getElementById("nav");
const openMenuBtn = document.getElementById("open-menu-btn");
const closeMenuBtn = document.getElementById("close-menu-btn");

if (openMenuBtn && closeMenuBtn && navElem) {
	openMenuBtn.addEventListener("click", () => {
		navElem.classList.add("show-menu");
	});
	closeMenuBtn.addEventListener("click", () => {
		navElem.classList.remove("show-menu");
	});
}

initializeSwiper();
