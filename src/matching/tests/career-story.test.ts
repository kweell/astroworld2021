import { describe, expect, it } from "vitest";
import { rankCareerStoryOffers } from "../scoring/rank-career-story-offers.js";
import { careerStoryOffers } from "../fixtures/career-story-offers.js";
import { careerStoryParticipant } from "../fixtures/participants.js";

describe("rankCareerStoryOffers", () => {
  it("ranks the most relevant offer first", () => {
    const results = rankCareerStoryOffers(careerStoryParticipant, careerStoryOffers);
    expect(results[0].offerId).toBe("offer-1");
  });

  it("excludes an offer with no remaining capacity", () => {
    const results = rankCareerStoryOffers(careerStoryParticipant, careerStoryOffers);
    expect(results.some((r) => r.offerId === "offer-2")).toBe(false);
  });

  it("is a separate ranking from volunteer-request matching (scores by offer, not by volunteer eligibility)", () => {
    const results = rankCareerStoryOffers(careerStoryParticipant, careerStoryOffers);
    expect(results.every((r) => typeof r.score === "number" && typeof r.offerId === "string")).toBe(true);
  });

  it("respects options.limit", () => {
    const results = rankCareerStoryOffers(careerStoryParticipant, careerStoryOffers, { limit: 1 });
    expect(results.length).toBe(1);
  });

  it("breaks ties deterministically by ascending offerId", () => {
    const offer = careerStoryOffers[0];
    const twin = { ...offer, offerId: "offer-0" };
    const results = rankCareerStoryOffers(careerStoryParticipant, [offer, twin]);
    expect(results.map((r) => r.offerId)).toEqual(["offer-0", offer.offerId]);
  });
});
