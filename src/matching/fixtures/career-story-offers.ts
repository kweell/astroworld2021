import type { CareerStoryOffer } from "../types/career-story.js";

/** At least 3 deterministic career_story offers spanning different industries and capacities. */
export const careerStoryOffers: CareerStoryOffer[] = [
  {
    offerId: "offer-1",
    volunteerId: "vol-alice",
    industryTags: ["technology"],
    topicTags: ["cybersecurity", "cloud infrastructure"],
    mode: "live_online",
    startsAt: "2025-03-12T01:00:00Z",
    endsAt: "2025-03-12T01:15:00Z",
    capacityRemaining: 5,
    accessFeatures: ["captioning", "written_instructions"],
    languages: ["english", "mandarin"],
  },
  {
    offerId: "offer-2",
    volunteerId: "vol-devi",
    industryTags: ["marketing", "retail"],
    topicTags: ["branding"],
    mode: "in_person",
    startsAt: "2025-03-13T02:00:00Z",
    endsAt: "2025-03-13T02:15:00Z",
    capacityRemaining: 0, // full: filtered out regardless of relevance
    accessFeatures: ["quiet_environment"],
    languages: ["english", "tamil"],
  },
  {
    offerId: "offer-3",
    volunteerId: "vol-farah",
    industryTags: ["healthcare"],
    topicTags: ["public health"],
    mode: "live_online",
    startsAt: "2025-03-20T09:00:00Z",
    endsAt: "2025-03-20T09:15:00Z",
    capacityRemaining: 3,
    accessFeatures: ["step_by_step_explanation"],
    languages: ["english", "malay"],
  },
  {
    offerId: "offer-4",
    volunteerId: "vol-gopal",
    industryTags: ["technology"],
    topicTags: ["product management"],
    mode: "live_online",
    startsAt: "2025-03-12T02:00:00Z",
    endsAt: "2025-03-12T02:15:00Z",
    capacityRemaining: 2,
    accessFeatures: ["written_instructions", "simple_language"],
    languages: ["english", "hindi"],
  },
];
