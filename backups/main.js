import './style.css'

// Configuration adaptative selon le device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const CONFIG = {
  sensitivity: isMobile ? 1.5 : 2, 
  lerp: isMobile ? 0.08 : 0.05, // Plus rapide sur mobile
  skewSensitivity: isMobile ? 0 : 0.005 // Désactivé sur mobile pour performances
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
let lastTouchTime = 0;
let snapTimeout = null;
let isSnapping = false;

// GESTION DU HOVER SCALE (désactivé sur mobile)
let imageScales = new Map();

// DOM Elements
const container = document.querySelector('#scroll-container');
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

// INITIALISATION HOVER LISTENERS (desktop uniquement)
if (!isMobile) {
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
}

// --- 1. INTRODUCTION (Loader) ---

let loadProgress = 0;

function simulateLoading() {
  const interval = setInterval(() => {
    loadProgress += Math.floor(Math.random() * 8) + 4; // Plus rapide
    if (loadProgress >= 100) {
      loadProgress = 100;
      clearInterval(interval);
      if(enterBtn) enterBtn.classList.add('visible');
    }
    if(loaderCount) loaderCount.textContent = loadProgress.toString().padStart(3, '0');
  }, 40);
}

function enterSite() {
  if(audio) {
    audio.volume = 0.5;
    audio.play().catch(() => console.log("Audio autoplay bloqué"));
    if(soundState) soundState.textContent = "ON";
  }
  
  document.body.classList.add('is-loaded');
    const cover = document.querySelector('.cover-section');
  if(cover) cover.classList.add('is-in-view');

  setTimeout(() => {
    initScroll();
  }, isMobile ? 500 : 1000);
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

menuTrigger.addEventListener('click', (e) => {
  e.preventDefault();
  menuOverlay.classList.add('active');
  isScrollActive = false;
  document.body.style.overflow = 'hidden';
});

closeMenuBtn.addEventListener('click', (e) => {
  e.preventDefault();
  menuOverlay.classList.remove('active');
  isScrollActive = true;
  document.body.style.overflow = '';
});

menuLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    menuOverlay.classList.remove('active');
    document.body.style.overflow = '';
    
    const targetId = link.getAttribute('data-target');
    const targetSection = document.getElementById(targetId);
    
    if (targetSection) {
      const targetX = targetSection.offsetLeft;
      const offset = isMobile ? (window.innerWidth * 0.05) : (window.innerWidth * 0.1);
      state.target = Math.max(0, Math.min(targetX - offset, state.limit));
    }
    
    // Réactiver le scroll après un court délai
    setTimeout(() => {
      isScrollActive = true;
    }, 100);
  });
});

// --- 3. GESTION AUDIO PREVIEWS ---
const trackButtons = document.querySelectorAll('.play-track-btn');
const allTrackAudios = document.querySelectorAll('.track-audio');

trackButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const trackId = btn.getAttribute('data-track');
    const targetAudio = document.getElementById(`track-${trackId}`);
    const isPlaying = !targetAudio.paused;
    
    // Pause de l'audio principal
    if(audio && !audio.paused) {
      audio.pause();
      if(soundState) soundState.textContent = "PAUSED";
    }
    
    // Stop tous les autres tracks
    allTrackAudios.forEach(trackAudio => {
      trackAudio.pause();
      trackAudio.currentTime = 0;
    });
    trackButtons.forEach(b => {
      b.textContent = "▶ PREVIEW";
      b.classList.remove('playing');
    });
    
    // Toggle lecture
    if (!isPlaying) {
      targetAudio.volume = 0.7;
      targetAudio.play().catch(err => console.log("Playback prevented:", err));
      btn.textContent = "■ STOP";
      btn.classList.add('playing');
    }
  });
});

// Reset des boutons quand un track se termine
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
  
  // Event listeners avec options optimisées
  window.addEventListener('resize', debounce(calculateLimit, 250));
  
  if (!isMobile) {
    window.addEventListener('wheel', handleScroll, { passive: false });
  }
  
  // Touch events pour mobile
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  
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

let touchStartX = 0;
let touchMoveX = 0;

function handleTouchStart(e) {
  if(!isScrollActive) return;
  touchStartX = e.touches[0].clientX;
  touchMoveX = touchStartX;
  lastTouchTime = Date.now();
}

function handleTouchMove(e) {
  if(!isScrollActive) return;
  
  // Prévenir le scroll natif
  if (Math.abs(e.touches[0].clientX - touchStartX) > 10) {
    e.preventDefault();
  }
  
  touchMoveX = e.touches[0].clientX;
  const delta = (touchStartX - touchMoveX) * (isMobile ? 2 : 3);
  state.target += delta;
  state.target = Math.max(0, Math.min(state.target, state.limit));
  touchStartX = touchMoveX;
}

function handleTouchEnd(e) {
  if(!isScrollActive) return;
  
  // Ajouter de l'inertie au swipe sur mobile
  if (isMobile) {
    const touchDuration = Date.now() - lastTouchTime;
    const touchDistance = touchMoveX - touchStartX;
    
    if (touchDuration < 200 && Math.abs(touchDistance) > 50) {
      // Swipe rapide détecté
      const velocity = touchDistance / touchDuration;
      state.target -= velocity * 200; // Ajouter momentum
      state.target = Math.max(0, Math.min(state.target, state.limit));
    }
    
    // Activer le snap après un court délai
    clearTimeout(snapTimeout);
    snapTimeout = setTimeout(() => {
      snapToNearestSection();
    }, 150);
  }
}

// Fonction pour trouver et snapper sur la section la plus proche (mobile uniquement)
function findNearestSection() {
  if (!isMobile) return null;
  
  const sections = Array.from(animatedSections);
  const viewportCenter = window.innerWidth / 2;
  let nearestSection = null;
  let minDistance = Infinity;
  
  sections.forEach(section => {
    const sectionLeft = section.offsetLeft;
    const sectionCenter = sectionLeft + (section.offsetWidth / 2);
    const distanceFromCenter = Math.abs((sectionCenter - state.current) - viewportCenter);
    
    if (distanceFromCenter < minDistance) {
      minDistance = distanceFromCenter;
      nearestSection = section;
    }
  });
  
  return nearestSection;
}

function snapToNearestSection() {
  if (!isMobile || isSnapping) return;
  
  const nearest = findNearestSection();
  if (!nearest) return;
  
  isSnapping = true;
  
  // Calculer la position cible pour centrer la section
  const sectionLeft = nearest.offsetLeft;
  const offset = window.innerWidth * 0.05; // Petit offset sur les bords
  
  // Animation douce vers la section
  state.target = Math.max(0, Math.min(sectionLeft - offset, state.limit));
  
  // Réactiver le scroll après l'animation
  setTimeout(() => {
    isSnapping = false;
  }, 600);
}

// --- 5. BOUCLE D'ANIMATION (RAF) ---

function raf() {
  // LERP SCROLL
  state.current = lerp(state.current, state.target, CONFIG.lerp);
  
  // SKEW EFFECT (desktop uniquement)
  const velocity = state.target - state.current;
  const skew = CONFIG.skewSensitivity * velocity;
  
  // Arrondi pour performance
  const currentScroll = Math.round(state.current * 100) / 100;
  
  if(container) {
    container.style.transform = `translate3d(${-currentScroll}px, 0, 0) skewX(${skew}deg)`;
  }

  // DETECTION DE VISIBILITÉ & PARALLAXE
  const viewportWidth = window.innerWidth;

  animatedSections.forEach(section => {
    const sectionLeft = section.offsetLeft - currentScroll;
    const sectionRight = sectionLeft + section.offsetWidth;
    const triggerPoint = viewportWidth * 0.85;

    if (sectionLeft < triggerPoint && sectionRight > 0) {
      if (!section.classList.contains('is-in-view')) {
        section.classList.add('is-in-view');
      }
    }

    // PARALLAXE IMAGES (desktop uniquement)
    if (!isMobile && sectionLeft < viewportWidth && sectionRight > 0) {
      const img = section.querySelector('img');
      if(img) {
        const progress = (sectionLeft + section.offsetWidth / 2 - viewportWidth / 2) / (viewportWidth / 2);
        const moveX = progress * 80;
        
        let s = imageScales.get(img) || { current: 1 };
        if(imageScales.has(img)) {
          s.current = lerp(s.current, s.target, 0.1);
        }
        
        img.style.transform = `translateX(${moveX}px) scale(${s.current})`;
      }
    }
  });

  requestAnimationFrame(raf);
}

// --- 6. CURSEUR & UTILITAIRES ---

let mouse = { x: 0, y: 0 };
let cursorPos = { x: 0, y: 0 };

if (!isMobile) {
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  
  document.querySelectorAll('.gallery-item, .menu-link').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovered'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovered'));
  });
}

function animateCursor() {
  if(!cursor || isMobile) return;
  cursorPos.x = lerp(cursorPos.x, mouse.x, 0.1);
  cursorPos.y = lerp(cursorPos.y, mouse.y, 0.1);
  cursor.style.transform = `translate(${cursorPos.x}px, ${cursorPos.y}px) translate(-50%, -50%)`;
  requestAnimationFrame(animateCursor);
}

function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

// Fonction debounce pour optimiser les resize events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- 7. EFFET ROLLING TEXT ---

function initRollingText() {
  const titles = document.querySelectorAll('.track-title'); 

  titles.forEach(title => {
    const originalHTML = title.innerHTML;
    const lines = originalHTML.split('<br>');
    title.innerHTML = '';

    lines.forEach((line, lineIndex) => {
      const lineContainer = document.createElement('div');
      lineContainer.className = 'anim-text-line';
      
      const lineInner = document.createElement('span');
      lineInner.className = 'anim-text-line-inner';

      // Sur mobile, on simplifie (pas de rolling par lettre)
      if (isMobile) {
        lineInner.textContent = line.trim();
      } else {
        // Desktop: effet rolling complet
        line.trim().split('').forEach((char, charIndex) => {
          if (char === ' ') {
            const space = document.createElement('span');
            space.className = 'char-space';
            space.innerHTML = '&nbsp;';
            lineInner.appendChild(space);
          } else {
            const wrapper = document.createElement('span');
            wrapper.className = 'char-wrap';
            const delay = (charIndex * 0.02) + 's';
            
            wrapper.innerHTML = `
              <span class="char-orig" style="transition-delay: ${delay}">${char}</span>
              <span class="char-clone" style="transition-delay: ${delay}">${char}</span>
            `;
            lineInner.appendChild(wrapper);
          }
        });
      }

      lineContainer.appendChild(lineInner);
      title.appendChild(lineContainer);
    });
  });
}

// --- 8. PRÉVENTION DU PULL-TO-REFRESH SUR MOBILE ---

if (isMobile) {
  let lastY = 0;
  
  document.body.addEventListener('touchstart', (e) => {
    lastY = e.touches[0].clientY;
  }, { passive: true });
  
  document.body.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    const isScrollingVertically = Math.abs(currentY - lastY) > Math.abs(e.touches[0].clientX - touchStartX);
    
    // Empêcher le pull-to-refresh si on scroll horizontalement
    if (!isScrollingVertically && window.scrollY === 0) {
      e.preventDefault();
    }
  }, { passive: false });
}

// --- 9. GESTION DES ERREURS AUDIO ---

// Gestion des erreurs de lecture audio
allTrackAudios.forEach(trackAudio => {
  trackAudio.addEventListener('error', (e) => {
    console.warn('Audio loading error:', e);
  });
});

if (audio) {
  audio.addEventListener('error', (e) => {
    console.warn('Background audio error:', e);
  });
}

// --- 10. OPTIMISATION PERFORMANCES ---

// Réduire la fréquence du RAF sur mobile si batterie faible
let rafThrottle = 1;
if (isMobile && 'getBattery' in navigator) {
  navigator.getBattery().then(battery => {
    if (battery.level < 0.2) {
      rafThrottle = 2; // Skip every other frame
    }
  });
}

let rafCounter = 0;
const originalRaf = raf;
raf = function() {
  rafCounter++;
  if (rafCounter % rafThrottle === 0) {
    originalRaf();
  } else {
    requestAnimationFrame(raf);
  }
}

// --- LANCEMENT ---
initRollingText();
if (!isMobile) {
  animateCursor();
}
simulateLoading();

// Log pour debug
console.log('Mobile detected:', isMobile);
console.log('Config:', CONFIG);
