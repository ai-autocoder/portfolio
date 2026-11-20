import i18next from "i18next";

// A project card's demo clip plays only while it can be seen: mostly on screen and, in the
// mobile carousel, on the active slide. With reduced motion it never starts by itself; the
// toggle button plays or pauses it, and the viewer's choice then wins over autoplay.
export default function initializeProjectVideos() {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

	document.querySelectorAll(".project-video").forEach((box) => {
		const video = box.querySelector("video");
		const toggle = box.querySelector(".project-video-toggle");
		const slide = box.closest(".swiper-slide");
		const carousel = box.closest(".swiper");
		let onScreen = false;
		let choice = null; // "play" or "pause" once the viewer pressed the button

		const shown = () =>
			onScreen &&
			(!slide ||
				carousel.classList.contains("projects-grid-mode") ||
				slide.classList.contains("swiper-slide-active"));

		const sync = () => {
			const wanted = shown() && (choice ? choice === "play" : !reduceMotion.matches);
			if (wanted && video.paused) {
				// play() also starts the download (preload="none"); a refusal leaves the poster
				video.play().catch(() => {});
			} else if (!wanted && !video.paused) {
				video.pause();
			}
		};

		const render = () => {
			box.classList.toggle("is-playing", !video.paused);
			toggle.setAttribute(
				"aria-label",
				i18next.t(video.paused ? "projects.video.play" : "projects.video.pause")
			);
		};

		video.addEventListener("playing", () => box.classList.add("is-started"));
		video.addEventListener("play", render);
		video.addEventListener("pause", render);
		// i18next may have announced its first language before this ran
		i18next.on("languageChanged", render);
		if (i18next.isInitialized) render();
		else i18next.on("initialized", render);

		// a press acts at once, even with the card only partly on screen
		toggle.addEventListener("click", () => {
			choice = video.paused ? "play" : "pause";
			if (choice === "play") video.play().catch(() => {});
			else video.pause();
		});
		toggle.hidden = false;

		new IntersectionObserver(
			(entries) => {
				onScreen = entries[entries.length - 1].isIntersecting; // the newest state
				sync();
			},
			{ threshold: 0.5 }
		).observe(box);

		// Swiper marks the active slide with a class, and the grid layout with another
		if (slide) {
			const classes = new MutationObserver(sync);
			classes.observe(slide, { attributeFilter: ["class"] });
			classes.observe(carousel, { attributeFilter: ["class"] });
		}
		reduceMotion.addEventListener("change", sync);
	});
}
