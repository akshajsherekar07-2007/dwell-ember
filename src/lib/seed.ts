import { DAY, HOUR, type DemoState, type Person, type Property, type Bed, type Allocation } from "./types";

export function createSeed(now = Date.now()): DemoState {
  const people: Person[] = [
    { id: "aarav", name: "Aarav Sharma", initials: "AS", credits: 3, saved: ["maple", "haven"] },
    { id: "riya", name: "Riya Patel", initials: "RP", credits: 2, saved: ["maple"] },
    { id: "kabir", name: "Kabir Shah", initials: "KS", credits: 1, saved: [] },
    { id: "meera", name: "Meera Rao", initials: "MR", credits: 3, saved: [] },
    ...["Dev Mehta", "Isha Roy", "Nikhil Jain", "Ananya Das", "Sana Ali", "Rohan Shah"].map((name, i) => ({ id: `resident-${i}`, name, initials: name.split(" ").map(n => n[0]).join(""), credits: 0, saved: [] })),
  ];
  const properties: Property[] = [
    { id: "maple", name: "Maple House", locality: "Koramangala", city: "Bengaluru", address: "5th Block, Koramangala, Bengaluru", category: "PG", price: 9500, deposit: 9500, distance: .8, image: "/images/maple.png", label: "Student favorite", description: "A little more room to feel at home. Thoughtful study corners, sunlit rooms, and everything you need for your next chapter, right in the heart of Koramangala.", amenities: ["Wi-Fi", "Meals", "Laundry", "Study room"], sharing: ["Single", "Twin"], contact: "+91 90000 00001", published: true },
    { id: "cedar", name: "Cedar Student Living", locality: "HSR Layout", city: "Bengaluru", address: "Sector 2, HSR Layout, Bengaluru", category: "Hostel", price: 11000, deposit: 11000, distance: 2.1, image: "/images/cedar.png", label: "Thoughtfully designed", description: "Your own space, a welcoming community. Airy shared rooms, dedicated workspaces, and simple comforts make student life feel a little easier.", amenities: ["Wi-Fi", "Meals", "Laundry", "AC"], sharing: ["Twin", "Triple"], contact: "+91 90000 00002", published: true },
    { id: "haven", name: "The Haven Collective", locality: "Indiranagar", city: "Bengaluru", address: "12th Main, Indiranagar, Bengaluru", category: "Co-living", price: 14500, deposit: 14500, distance: 3.4, image: "/images/haven.png", label: "Room to belong", description: "Independent living, shared moments. A calm home with bright common spaces, a leafy balcony, and a community of people starting something new.", amenities: ["Wi-Fi", "Laundry", "AC", "Power backup"], sharing: ["Single", "Twin"], contact: "+91 90000 00003", published: true },
    { id: "olive", name: "Olive Study House", locality: "Koramangala", city: "Bengaluru", address: "6th Block, Koramangala, Bengaluru", category: "PG", price: 8000, deposit: 8000, distance: 1.2, image: "/images/cedar.png", description: "A quiet base for busy student days. Shared rooms, home-style meals, and a friendly neighborhood close to campus.", amenities: ["Wi-Fi", "Meals", "Study room"], sharing: ["Twin", "Triple"], contact: "+91 90000 00004", published: true },
    { id: "elm", name: "Elm & Oak Residences", locality: "HSR Layout", city: "Bengaluru", address: "Sector 7, HSR Layout, Bengaluru", category: "Co-living", price: 12500, deposit: 12500, distance: 2.8, image: "/images/maple.png", description: "Designed for focus and downtime. Warm interiors and practical amenities in a connected, walkable neighborhood.", amenities: ["Wi-Fi", "Laundry", "AC"], sharing: ["Single", "Twin"], contact: "+91 90000 00005", published: true },
    { id: "fern", name: "Fern Campus Stay", locality: "Indiranagar", city: "Bengaluru", address: "HAL 2nd Stage, Indiranagar, Bengaluru", category: "Hostel", price: 7000, deposit: 7000, distance: 4.2, image: "/images/haven.png", description: "An easy place to start. Comfortable beds, dependable essentials, and a community that makes a new city familiar.", amenities: ["Wi-Fi", "Meals", "Power backup"], sharing: ["Twin", "Triple"], contact: "+91 90000 00006", published: true },
  ];
  const beds: Bed[] = [];
  for (const property of properties) {
    for (let room = 201; room <= (property.id === "maple" ? 203 : 202); room++) {
      for (const label of ["A", "B", "C", "D"]) beds.push({id: `${property.id}-${room}-${label}`, propertyId: property.id, floor: 1, room: String(room), label, enabled: true, version: 1});
    }
  }
  const allocations: Allocation[] = [
    { id: "hold-aarav", bedId: "maple-203-B", studentId: "aarav", state: "held", source: "owner", durationHours: 48, createdAt: now - 13 * HOUR, acceptedAt: now - 12 * HOUR, expiresAt: now + 36 * HOUR, version: 1 },
    { id: "hold-dev", bedId: "maple-201-C", studentId: "resident-0", state: "held", source: "owner", durationHours: 48, createdAt: now - 29 * HOUR, acceptedAt: now - 28 * HOUR, expiresAt: now + 20 * HOUR, version: 1 },
    { id: "hold-sana", bedId: "maple-203-C", studentId: "resident-4", state: "held", source: "owner", durationHours: 48, createdAt: now - 38 * HOUR, acceptedAt: now - 37 * HOUR, expiresAt: now + 11 * HOUR, version: 1 },
    ...["maple-201-D", "maple-202-C", "maple-202-D", "maple-203-D"].map((bedId, i): Allocation => ({id: `booked-${i}`, bedId, studentId: `resident-${i+1}`, state: "booked", source: "owner", durationHours: 48, createdAt: now - 8 * DAY, acceptedAt: now - 8 * DAY, version: 1, moveInDate: new Date(now - 7 * DAY).toISOString().slice(0, 10), agreedPrice: 9500})),
  ];
  return {
    revision: 1, clockOffset: 0, people, properties, beds, allocations,
    queues: ["riya", "kabir", "meera"].map((studentId, i) => ({id: `queue-${studentId}`, bedId: "maple-203-B", studentId, sequence: i + 1, state: "waiting", createdAt: now - (5 - i) * HOUR})),
    sequence: 3, access: [], requests: {},
    notices: [{id: "welcome-hold", studentId: "aarav", title: "Your space, held for you", message: "Your hold at Maple House is active. You have time to decide before the deadline.", createdAt: now - 12 * HOUR, read: false}],
    activity: [{id: "activity-initial", action: "Hold accepted", detail: "Aarav Sharma · Maple House, Room 203 · Bed B", createdAt: now - 12 * HOUR}],
    ledger: people.map(p => ({id: `credit-${p.id}`, studentId: p.id, delta: p.credits, label: "Welcome demo credits", createdAt: now})),
  };
}
