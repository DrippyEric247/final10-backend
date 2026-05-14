import api from "./authService";

async function trackOfferClick(offerId, offer) {
  const { data } = await api.post(`/offers/${encodeURIComponent(offerId)}/click`, { offer });
  return data;
}

async function claimOfferReward(offerId, offer) {
  const { data } = await api.post(`/offers/${encodeURIComponent(offerId)}/claim`, { offer });
  return data;
}

async function getOfferInteractions(offerIds = []) {
  if (!offerIds.length) return { interactions: [] };
  const { data } = await api.get("/offers/interactions", {
    params: { offerIds: offerIds.join(",") },
  });
  return data;
}

const offersService = {
  trackOfferClick,
  claimOfferReward,
  getOfferInteractions,
};

export default offersService;

