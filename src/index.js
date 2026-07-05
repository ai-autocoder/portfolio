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

// Scroll-triggered entrance animations
const initScrollAnimations = () => {
	const animatedElements = document.querySelectorAll(
		".about-text-card, .about-links, .service-card, .tech-category, .stat-card, .footer-title, .contact form"
	);

	if (!animatedElements.length) return;

	// Add initial hidden state
	animatedElements.forEach((el) => {
		el.classList.add("scroll-hidden");
	});

	const observerOptions = {
		root: null,
		rootMargin: "0px 0px -80px 0px",
		threshold: 0.1,
	};

	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add("scroll-visible");
				entry.target.classList.remove("scroll-hidden");
				observer.unobserve(entry.target);
			}
		});
	}, observerOptions);

	animatedElements.forEach((el) => observer.observe(el));
};

// Initialize after DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initScrollAnimations);
} else {
	initScrollAnimations();
}
