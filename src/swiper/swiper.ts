import Swiper from "swiper";
import { EffectCoverflow, Keyboard, Navigation, Pagination } from "swiper/modules";
// Direct file paths: Parcel's default resolver does not read the package
// "exports" aliases like "swiper/css"
import "swiper/swiper.css";
import "swiper/modules/navigation.css";
import "swiper/modules/pagination.css";
import "swiper/modules/effect-coverflow.css";

// Above this width the projects render as a static CSS grid
// (see projects-grid-mode in styles/swiper.scss) instead of a carousel.
const GRID_MEDIA_QUERY = "(min-width: 992px)";

let swiper: Swiper | null = null;

function createSwiper(): Swiper {
	return new Swiper(".swiper", {
		modules: [Navigation, Pagination, Keyboard, EffectCoverflow],
		direction: "horizontal",
		loop: false,
		slidesPerView: 1,
		spaceBetween: 100,
		centeredSlides: true,
		keyboard: true,
		grabCursor: true,
		followFinger: true,
		autoHeight: true,
		allowTouchMove: true,
		slideToClickedSlide: true,
		effect: "coverflow",
		coverflowEffect: {
			rotate: 0,
			stretch: 0,
			depth: 150,
			scale: 0.9,
			slideShadows: false,
		},
		pagination: {
			el: ".swiper-pagination",
			clickable: true,
		},
		navigation: {
			nextEl: ".swiper-button-next",
			prevEl: ".swiper-button-prev",
		},
	});
}

export default function initializeSwiper() {
	const container = document.querySelector<HTMLElement>(".swiper");
	if (!container) return;

	const gridQuery = window.matchMedia(GRID_MEDIA_QUERY);

	const sync = () => {
		if (gridQuery.matches) {
			if (swiper) {
				swiper.destroy(true, true);
				swiper = null;
			}
			container.classList.add("projects-grid-mode");
		} else {
			container.classList.remove("projects-grid-mode");
			if (!swiper) {
				swiper = createSwiper();
			}
		}
	};

	gridQuery.addEventListener("change", sync);
	sync();
}
