import './style.css'

// Configuration adaptative selon le device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const CONFIG = {
  sensitivity: 2, 
  lerp: 0.05, 
  skewSensitivity: 0.005 
}

// État
let state = {
  current: 0,
  target: 0,
  limit: 0
}

let isScrollActive = false;

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
    loadProgress += Math.floor(Math.random() * 8) + 4; 
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
  
  // Animation d'entrée pour la Cover Section
  const cover = document.querySelector('.cover-section');
  if(cover) cover.classList.add('is-in-view');

  setTimeout(() => {
    initScroll();
  }, isMobile ? 100 : 1000); 
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
      if (isMobile) {
        // SCROLL NATIF POUR MOBILE (Direct & Smooth)
        targetSection.scrollIntoView({ behavior: 'smooth', inline: 'start' });
      } else {
        // SCROLL JS POUR DESKTOP
        const targetX = targetSection.offsetLeft;
        const offset = window.innerWidth * 0.1;
        state.target = Math.max(0, Math.min(targetX - offset, state.limit));
      }
    }
    
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
  
  window.addEventListener('resize', debounce(calculateLimit, 250));
  
  // Sur Desktop, on active le scroll hijack (Wheel)
  if (!isMobile) {
    window.addEventListener('wheel', handleScroll, { passive: false });
  }
  
  // Sur Mobile, on NE FAIT RIEN. On laisse le CSS (overflow-x: scroll) gérer.
  
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
  // Uniquement sur Desktop
  e.preventDefault();
  state.target += (e.deltaY + e.deltaX) * CONFIG.sensitivity;
  state.target = Math.max(0, Math.min(state.target, state.limit));
}

// --- 5. BOUCLE D'ANIMATION (RAF) ---

function raf() {
  
  // --- A. MOBILE : NATIVE SCROLL ---
  if (isMobile) {
    // On ne transforme PAS le container. On laisse le navigateur faire.
    // On lit juste la position pour déclencher les animations "In View"
    if(container) {
      const currentScroll = container.scrollLeft;
      
      // Détection de visibilité (Simplifiée pour mobile)
      animatedSections.forEach(section => {
        // Centre de la section
        const sectionCenter = section.offsetLeft + (section.offsetWidth / 2);
        // Centre de l'écran
        const screenCenter = currentScroll + (window.innerWidth / 2);
        
        // Si le centre de la section est proche du centre de l'écran
        if (Math.abs(sectionCenter - screenCenter) < window.innerWidth * 0.4) {
           section.classList.add('is-in-view');
        }
      });
    }
  } 
  
  // --- B. DESKTOP : CUSTOM SCROLL ---
  else {
    // LERP SCROLL (Inertie)
    state.current = lerp(state.current, state.target, CONFIG.lerp);
    
    // SKEW EFFECT
    const velocity = state.target - state.current;
    const skew = CONFIG.skewSensitivity * velocity;
    
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

      // PARALLAXE IMAGES (Desktop only)
      if (sectionLeft < viewportWidth && sectionRight > 0) {
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
  }

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

      if (isMobile) {
        // Mobile simple
        lineInner.textContent = line.trim();
      } else {
        // Desktop rolling
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

// --- 8. PREVENT PULL-TO-REFRESH (Mobile Only) ---
// Utile pour éviter le reload quand on swipe fort sur les bords

if (isMobile) {
  document.body.style.overscrollBehaviorY = 'none';
}

// --- 9. GESTION DES ERREURS AUDIO ---

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

// --- LANCEMENT ---
initRollingText();
if (!isMobile) {
  animateCursor();
}
simulateLoading();

console.log('Mode:', isMobile ? 'Mobile (Native Scroll)' : 'Desktop (Custom Scroll)');