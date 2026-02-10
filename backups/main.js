import './style.css'

// Configuration
const CONFIG = {
  sensitivity: 2, 
  lerp: 0.05,     
  skewSensitivity: 0.005 // Augmenté pour plus de dynamisme
}

// État
let state = {
  current: 0,
  target: 0,
  limit: 0
}

let isScrollActive = false;
let touchStart = 0;
let touchCurrent = 0;

// GESTION DU HOVER SCALE
let imageScales = new Map();

// DOM Elements
const container = document.querySelector('#scroll-container');
// Sélectionner TOUTES les sections qui doivent s'animer
const animatedSections = document.querySelectorAll('.gallery-item'); 
const images = document.querySelectorAll('.image-wrapper img');
const cursor = document.getElementById('cursor');

// Elements Intro & Audio
const loaderCount = document.getElementById('loader-count');
const enterBtn = document.getElementById('enter-btn');
const audio = document.getElementById('audio-player');
const soundBtn = document.getElementById('sound-toggle');
const soundState = soundBtn ? soundBtn.querySelector('.state') : null;

// Elements Menu
const menuTrigger = document.getElementById('menu-trigger');
const menuOverlay = document.getElementById('menu-overlay');
const closeMenuBtn = document.getElementById('close-menu');
const menuLinks = document.querySelectorAll('.menu-link');

// INITIALISATION HOVER LISTENERS
images.forEach(img => {
  imageScales.set(img, { current: 1, target: 1 });
  
  img.parentElement.addEventListener('mouseenter', () => {
    let s = imageScales.get(img);
    s.target = 1.1;
  });
  
  img.parentElement.addEventListener('mouseleave', () => {
    let s = imageScales.get(img);
    s.target = 1.0;
  });
});

// --- 1. INTRODUCTION (Loader) ---

let loadProgress = 0;

function simulateLoading() {
  const interval = setInterval(() => {
    loadProgress += Math.floor(Math.random() * 5) + 2; // Plus rapide
    if (loadProgress >= 100) {
      loadProgress = 100;
      clearInterval(interval);
      if(enterBtn) enterBtn.classList.add('visible');
    }
    if(loaderCount) loaderCount.textContent = loadProgress.toString().padStart(3, '0');
  }, 50);
}

function enterSite() {
  if(audio) {
    audio.volume = 0.5;
    audio.play().catch(() => console.log("Audio autoplay bloqué"));
    if(soundState) soundState.textContent = "ON";
  }
  
  document.body.classList.add('is-loaded');
  
  // Animation d'entrée pour la Cover Section immédiatement
  const cover = document.querySelector('.cover-section');
  if(cover) cover.classList.add('is-in-view');

  // Petit délai avant de donner la main au scroll
  setTimeout(() => {
    initScroll();
  }, 1000);
}

if(soundBtn && audio) {
  soundBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      if(soundState) soundState.textContent = "ON";
    } else {
      audio.pause();
      if(soundState) soundState.textContent = "OFF";
    }
  });
}

if(enterBtn) enterBtn.addEventListener('click', enterSite);

// --- 2. GESTION DU MENU ---

menuTrigger.addEventListener('click', () => {
  menuOverlay.classList.add('active');
  isScrollActive = false; 
});

closeMenuBtn.addEventListener('click', () => {
  menuOverlay.classList.remove('active');
  isScrollActive = true;
});

menuLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    menuOverlay.classList.remove('active');
    isScrollActive = true;
    
    const targetId = link.getAttribute('data-target');
    const targetSection = document.getElementById(targetId);
    
    if (targetSection) {
      // Calculer la position target en tenant compte du viewport
      const targetX = targetSection.offsetLeft;
      state.target = Math.max(0, Math.min(targetX - (window.innerWidth * 0.1), state.limit)); // Centrer un peu
      // Pas de saut direct, on laisse le lerp faire pour la fluidité
    }
  });
});


// --- 3. GESTION AUDIO PREVIEWS ---
const trackButtons = document.querySelectorAll('.play-track-btn');
const allTrackAudios = document.querySelectorAll('.track-audio');

trackButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const trackId = btn.getAttribute('data-track');
    const targetAudio = document.getElementById(`track-${trackId}`);
    const isPlaying = !targetAudio.paused;
    
    if(audio && !audio.paused) {
        audio.pause();
        if(soundState) soundState.textContent = "PAUSED";
    }
    
    allTrackAudios.forEach(trackAudio => {
      trackAudio.pause();
      trackAudio.currentTime = 0;
    });
    trackButtons.forEach(b => {
      b.textContent = "▶ PREVIEW";
      b.classList.remove('playing');
    });
    
    if (!isPlaying) {
      targetAudio.volume = 0.7;
      targetAudio.play();
      btn.textContent = "■ STOP";
      btn.classList.add('playing');
    }
  });
});

allTrackAudios.forEach(trackAudio => {
  trackAudio.addEventListener('ended', () => {
     trackButtons.forEach(b => {
      b.textContent = "▶ PREVIEW";
      b.classList.remove('playing');
    });
  });
});


// --- 4. MOTEUR DE SCROLL ---

function initScroll() {
  calculateLimit();
  window.addEventListener('resize', calculateLimit);
  window.addEventListener('wheel', handleScroll, { passive: false });
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  isScrollActive = true;
  requestAnimationFrame(raf);
}

function calculateLimit() {
  if(!container) return;
  state.limit = container.scrollWidth - window.innerWidth;
  state.limit = Math.max(0, state.limit);
}

function handleScroll(e) {
  if(!isScrollActive) return;
  e.preventDefault();
  state.target += (e.deltaY + e.deltaX) * CONFIG.sensitivity;
  state.target = Math.max(0, Math.min(state.target, state.limit));
}

function handleTouchStart(e) {
  if(!isScrollActive) return;
  touchStart = e.touches[0].clientX;
}

function handleTouchMove(e) {
  if(!isScrollActive) return;
  e.preventDefault();
  touchCurrent = e.touches[0].clientX;
  const delta = (touchStart - touchCurrent) * 3; 
  state.target += delta;
  state.target = Math.max(0, Math.min(state.target, state.limit));
  touchStart = touchCurrent;
}

// --- 5. BOUCLE D'ANIMATION (RAF) ---

function raf() {
  // LERP SCROLL
  state.current = lerp(state.current, state.target, CONFIG.lerp);
  
  // SKEW EFFECT (Vitesse du scroll déforme le container)
  const velocity = state.target - state.current;
  const skew = velocity * CONFIG.skewSensitivity;

  // Arrondi pour performance
  const currentScroll = Math.round(state.current * 100) / 100;
  
  if(container) {
    container.style.transform = `translate3d(${-currentScroll}px, 0, 0) skewX(${skew}deg)`;
  }

  // DETECTION DE VISIBILITÉ (SCROLL TRIGGER) & PARALLAXE
  const viewportWidth = window.innerWidth;

  animatedSections.forEach(section => {
    // Calcul de la position de la section par rapport à l'écran
    // Position réelle = OffsetLeft - ScrollActuel
    const sectionLeft = section.offsetLeft - currentScroll;
    const sectionRight = sectionLeft + section.offsetWidth;

    // Seuil de déclenchement (la section s'anime quand elle entre de 10% dans l'écran)
    const triggerPoint = viewportWidth * 0.85; 

    if (sectionLeft < triggerPoint && sectionRight > 0) {
      if (!section.classList.contains('is-in-view')) {
        section.classList.add('is-in-view');
      }
    } 
    // Optionnel: retirer la classe si on veut rejouer l'anim au retour (souvent mieux sans pour UX)
    // else { section.classList.remove('is-in-view'); }

    // PARALLAXE IMAGES (Seulement si visible pour perf)
    if (sectionLeft < viewportWidth && sectionRight > 0) {
        const img = section.querySelector('img');
        if(img) {
            // Calculer la progression de la section dans l'écran (-1 à 1)
            const progress = (sectionLeft + section.offsetWidth / 2 - viewportWidth / 2) / (viewportWidth / 2);
            
            // Intensité parallaxe
            const moveX = progress * 80; // Bouge de 80px
            
            // On combine avec le scale du hover
            let s = imageScales.get(img) || { current: 1 };
            // On lerp le scale ici aussi pour être sûr
            if(imageScales.has(img)) {
               s.current = lerp(s.current, s.target, 0.1);
            }
            
            // Application transform
            img.style.transform = `translateX(${moveX}px) scale(${s.current})`;
        }
    }
  });

  requestAnimationFrame(raf);
}

// --- 6. CURSEUR & UTILITAIRES ---

let mouse = { x: 0, y: 0 };
let cursorPos = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function animateCursor() {
  if(!cursor) return;
  cursorPos.x = lerp(cursorPos.x, mouse.x, 0.1);
  cursorPos.y = lerp(cursorPos.y, mouse.y, 0.1);
  cursor.style.transform = `translate(${cursorPos.x}px, ${cursorPos.y}px) translate(-50%, -50%)`;
  requestAnimationFrame(animateCursor);
}

function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

document.querySelectorAll('.gallery-item, .menu-link').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('hovered'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('hovered'));
});

// --- 7. EFFET ROLLING TEXT (MODIFIÉ POUR ANIMATION D'ENTRÉE) ---

function initRollingText() {
  const titles = document.querySelectorAll('.track-title'); 

  titles.forEach(title => {
    const originalHTML = title.innerHTML;
    const lines = originalHTML.split('<br>');
    title.innerHTML = '';

    lines.forEach((line, lineIndex) => {
      // 1. WRAPPER EXTERNE (Masque pour l'apparition ligne par ligne)
      const lineContainer = document.createElement('div');
      lineContainer.className = 'anim-text-line';
      
      // 2. WRAPPER INTERNE (Celui qui bouge de bas en haut à l'apparition)
      const lineInner = document.createElement('span');
      lineInner.className = 'anim-text-line-inner';

      // 3. LOGIQUE ROLLING (Lettre par lettre)
      line.trim().split('').forEach((char, charIndex) => {
        if (char === ' ') {
          const space = document.createElement('span');
          space.className = 'char-space';
          space.innerHTML = '&nbsp;';
          lineInner.appendChild(space);
        } else {
          const wrapper = document.createElement('span');
          wrapper.className = 'char-wrap';
          const delay = (charIndex * 0.02) + 's'; // Délai rapide pour le roll
          
          wrapper.innerHTML = `
            <span class="char-orig" style="transition-delay: ${delay}">${char}</span>
            <span class="char-clone" style="transition-delay: ${delay}">${char}</span>
          `;
          lineInner.appendChild(wrapper);
        }
      });

      lineContainer.appendChild(lineInner);
      title.appendChild(lineContainer);
    });
  });
}

// LANCEMENT
initRollingText();
animateCursor();
simulateLoading();