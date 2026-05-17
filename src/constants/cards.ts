
export const CARD_URLS = {
  back: "https://i.ibb.co/HTXnM5kZ/dorso.jpg",
  caballos: [
    "https://i.ibb.co/jkqdxsNc/caballooros.jpg",
    "https://i.ibb.co/whBcy8xK/caballobastos.jpg",
    "https://i.ibb.co/Y4z524GG/caballoespadas.jpg",
    "https://i.ibb.co/nqrszdrg/caballocopas.jpg"
  ],
  witch: "https://i.ibb.co/xSmdGgtP/sotacopas.jpg",
  cupid: "https://i.ibb.co/GfDrkqdF/ascopas.jpg",
  villagerNumbers: [
    "https://i.ibb.co/5mVHtRW/dosoros.jpg",
    "https://i.ibb.co/7NpZ1kQg/tresoros.jpg",
    "https://i.ibb.co/tTQbzFjB/cuatrooros.jpg",
    "https://i.ibb.co/tTy81KMZ/cincooros.jpg",
    "https://i.ibb.co/NdHnLqr6/seisoros.jpg",
    "https://i.ibb.co/21MGjGpS/sieteoros.jpg",
    "https://i.ibb.co/mrMsyHL9/ochoros.jpg",
    "https://i.ibb.co/xSVML6Ck/nueveoros.jpg",
    "https://i.ibb.co/dwDp47mt/dosbastos.jpg",
    "https://i.ibb.co/TDYkYQdZ/tresbastos.jpg",
    "https://i.ibb.co/9k0mqHSr/cuatrobastos.jpg",
    "https://i.ibb.co/67W2wB9q/cincobastos.jpg",
    "https://i.ibb.co/cK123xNw/seisbastos.jpg",
    "https://i.ibb.co/hF26xZWR/sietebastos.jpg",
    "https://i.ibb.co/WppkcW5r/ochobastos.jpg",
    "https://i.ibb.co/Kx09wyxS/nuevebastos.jpg",
    "https://i.ibb.co/67p6Nc5K/dosespadas.jpg",
    "https://i.ibb.co/gML6Ktjw/tresespadas.jpg",
    "https://i.ibb.co/s97Qsqm0/cuatroespadas.jpg",
    "https://i.ibb.co/HTzBgw2L/cincoespadas.jpg",
    "https://i.ibb.co/B2PLrG69/seisespadas.jpg",
    "https://i.ibb.co/PvwmDj0K/sieteespadas.jpg",
    "https://i.ibb.co/8DDXZg17/ochoespadas.jpg",
    "https://i.ibb.co/RTTG1ZgQ/nueveespadas.jpg",
    "https://i.ibb.co/1VcsyZ6/doscopas.jpg",
    "https://i.ibb.co/tTLx90y3/trescopas.jpg",
    "https://i.ibb.co/cX2smTzq/cuatrocopas.jpg",
    "https://i.ibb.co/jkYw2XKb/cincocopas.jpg",
    "https://i.ibb.co/Fqwh4cjX/seiscopas.jpg",
    "https://i.ibb.co/nschfnZD/sietecopas.jpg",
    "https://i.ibb.co/B25NXpsd/ochocopas.jpg",
    "https://i.ibb.co/KzcpC8DX/nuevecopas.jpg"
  ]
};

export const getRoleCard = (role: string, seed: string) => {
  // Use a simple hash of the seed to get a consistent random card for this game
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  if (role === 'werewolf') {
    return CARD_URLS.caballos[hash % CARD_URLS.caballos.length];
  }
  if (role === 'witch') {
    return CARD_URLS.witch;
  }
  if (role === 'cupid') {
    return CARD_URLS.cupid;
  }
  // Default to villager
  return CARD_URLS.villagerNumbers[hash % CARD_URLS.villagerNumbers.length];
};
