import api from "./authService";

const businessOffersService = {
  async getOverview() {
    const { data } = await api.get("/business-offers/dashboard/overview");
    return data;
  },
  async getMyOffers() {
    const { data } = await api.get("/business-offers");
    return data;
  },
  async createOffer(payload) {
    const { data } = await api.post("/business-offers", payload);
    return data;
  },
  async updateOffer(id, payload) {
    const { data } = await api.put(`/business-offers/${id}`, payload);
    return data;
  },
  async updateStatus(id, status) {
    const { data } = await api.put(`/business-offers/${id}/status`, { status });
    return data;
  },
  async getPublicOffers() {
    const { data } = await api.get("/business-offers/public");
    return data;
  },
};

export default businessOffersService;

