(function initSocialButtonsConfig() {
  const socialButtons = {
    discord: {
      label: "Discord",
      offsiteKey: "discord",
      bg: "linear-gradient(145deg, #3f4f8a, #2d3965)",
      border: "#6b7bc0",
      hoverBg: "linear-gradient(145deg, #4e61a5, #39497d)",
      hoverBorder: "#8c9ddb",
      icon: `<svg class="site-icon-discord" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M18.59 5.88997C17.36 5.31997 16.05 4.89997 14.67 4.65997C14.5 4.95997 14.3 5.36997 14.17 5.69997C12.71 5.47997 11.26 5.47997 9.83001 5.69997C9.69001 5.36997 9.49001 4.95997 9.32001 4.65997C7.94001 4.89997 6.63001 5.31997 5.40001 5.88997C2.92001 9.62997 2.25001 13.28 2.58001 16.87C4.23001 18.1 5.82001 18.84 7.39001 19.33C7.78001 18.8 8.12001 18.23 8.42001 17.64C7.85001 17.43 7.31001 17.16 6.80001 16.85C6.94001 16.75 7.07001 16.64 7.20001 16.54C10.33 18 13.72 18 16.81 16.54C16.94 16.65 17.07 16.75 17.21 16.85C16.7 17.16 16.15 17.42 15.59 17.64C15.89 18.23 16.23 18.8 16.62 19.33C18.19 18.84 19.79 18.1 21.43 16.87C21.82 12.7 20.76 9.08997 18.61 5.88997H18.59ZM8.84001 14.67C7.90001 14.67 7.13001 13.8 7.13001 12.73C7.13001 11.66 7.88001 10.79 8.84001 10.79C9.80001 10.79 10.56 11.66 10.55 12.73C10.55 13.79 9.80001 14.67 8.84001 14.67ZM15.15 14.67C14.21 14.67 13.44 13.8 13.44 12.73C13.44 11.66 14.19 10.79 15.15 10.79C16.11 10.79 16.87 11.66 16.86 12.73C16.86 13.79 16.11 14.67 15.15 14.67Z" fill="#000000"></path>
      </svg>`
    },
    youtube: {
      label: "YouTube",
      offsiteKey: "youtube",
      bg: "linear-gradient(145deg, #c01a1a, #8d1212)",
      border: "#ea4c4c",
      hoverBg: "linear-gradient(145deg, #d72626, #a51717)",
      hoverBorder: "#f46a6a",
      icon: `<svg class="site-icon-youtube" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"></path>
      </svg>`
    },
    trucky: {
      label: "TruckyMods",
      bg: "linear-gradient(145deg, #952d45, #6f2134)",
      border: "#b44a63",
      hoverBg: "linear-gradient(145deg, #aa3751, #7e273b)",
      hoverBorder: "#c8627a",
      icon: `<img class="site-icon-trucky" alt="" aria-hidden="true" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAb1BMVEWlF0WkEkKiAz6iAD2hADqiADujDECrKVG/ZH7KhZjTmarYo7LZqLbdsL7If5S5VXS0SGj89/n////oxtHjucf++/z37PDz4ujw2+Hu1967XHinHUrkvsqtMligADbFeI7NjZ/qzdacACzCcYj79PaLgLzIAAABD0lEQVR4AaWRBZLEIBBFByeeNHEkev8z7nhg1ndfCfK6q+vD6d8gTOgNRviL40JGcZJmWZbEeYFQ4MoKPFTQS2toqrbrh6Hv2qqBEXuN2pRWc+bOMK7FFBP0cCTvEnfMQQj3nX0caQozDab0UPLH3sBEfOkUjE+5gHSM0ktAfo7L1hq2RzWOl3iLknrpu65f6mSWRhXPNE5CyM6PLGR6lQL9TOLtC8nt3oCP8ZKRGcZ6b68Ve9tsWWWRL4toyOorWa+zJpwpi04pc3ZKDeuya2/mCCppa6POGDVEbRf8NZxp7gDA4P0nshUEGOa1MgXQ3tM050LpdZ6faMlOQghrhdDForwkZzBl6AGn7uz+xxvjxBtOIzFU5gAAAABJRU5ErkJggg==" />`
    },
    tiktok: {
      label: "TikTok",
      bg: "linear-gradient(145deg, #161616, #0a0a0a)",
      border: "#3f3f3f",
      hoverBg: "linear-gradient(145deg, #202020, #101010)",
      hoverBorder: "#565656",
      icon: `<svg class="site-icon-tiktok" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 3v9.1a3.9 3.9 0 1 1-2.8-3.7v2.3a1.7 1.7 0 1 0 .6 1.3V3h2.2c.2 1.6 1.5 2.8 3.1 3v2.2A5.3 5.3 0 0 1 14 6.9V3z"></path>
      </svg>`
    },
    github: {
      label: "GitHub",
      bg: "linear-gradient(145deg, #2b3137, #1f2328)",
      border: "#59636e",
      hoverBg: "linear-gradient(145deg, #343b43, #262b31)",
      hoverBorder: "#738090",
      icon: `<svg class="site-icon-github" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.45-1.11-1.45-.91-.62.07-.61.07-.61 1 .08 1.53 1.04 1.53 1.04.9 1.54 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.03A9.53 9.53 0 0 1 12 6.8c.85 0 1.71.11 2.52.33 1.9-1.3 2.74-1.03 2.74-1.03.55 1.38.21 2.41.1 2.66.64.7 1.03 1.6 1.03 2.69 0 3.85-2.35 4.7-4.58 4.95.36.31.69.92.69 1.86v2.75c0 .26.18.58.69.48A10 10 0 0 0 12 2z"></path>
      </svg>`
    },
    email: {
      label: "Email",
      type: "email",
      bg: "linear-gradient(145deg, #3a3f49, #292d35)",
      border: "#5f687a",
      hoverBg: "linear-gradient(145deg, #4a5261, #353c49)",
      hoverBorder: "#7b869e",
      icon: `<svg class="site-icon-email" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18v12H3z"></path>
        <path d="M3 7l9 6 9-6"></path>
      </svg>`
    }
  };

  window.SITE_SOCIAL_BUTTONS = socialButtons;
})();
