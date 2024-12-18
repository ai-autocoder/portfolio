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
document.getElementById("open-menu-btn").addEventListener("click", () => {
	navElem.classList.add("show-menu");
});
document.getElementById("close-menu-btn").addEventListener("click", () => {
	navElem.classList.remove("show-menu");
});

initializeSwiper();
