import { createClient } from 'https://esm.sh/@base44/sdk';

const APP_ID = '6ac0c4d39306549ee04c755b';
const base44 = createClient({ appId: APP_ID });

function addGoogleButton() {
  const card = document.querySelector('.login-card');
  if (!card || document.getElementById('googleLogin')) return;

  const btn = document.createElement('button');
  btn.id = 'googleLogin';
  btn.type = 'button';
  btn.innerHTML = '<span style="font-weight:700;font-size:18px">G</span><span>המשך עם Google</span>';
  btn.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 0 8px;padding:13px 16px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#202124;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.06)';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'מעביר ל-Google…';
    const returnUrl = `${window.location.origin}${window.location.pathname}`;
    try {
      base44.auth.loginWithProvider('google', returnUrl);
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = '<span style="font-weight:700;font-size:18px">G</span><span>המשך עם Google</span>';
      console.error('Google login failed', e);
    }
  });

  const form = card.querySelector('#loginForm');
  if (form) {
    card.insertBefore(btn, form);
    const sep = document.createElement('div');
    sep.style.cssText = 'display:flex;align-items:center;gap:10px;margin:12px 0;color:#999;font-size:12px';
    sep.innerHTML = '<span style="height:1px;background:#e5e5e5;flex:1"></span><span>או עם אימייל</span><span style="height:1px;background:#e5e5e5;flex:1"></span>';
    card.insertBefore(sep, form);
  } else {
    card.appendChild(btn);
  }
}

const observer = new MutationObserver(addGoogleButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
addGoogleButton();
