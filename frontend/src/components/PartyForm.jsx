
import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";

export default function PartyForm({ party, setParty, onSubmit, loading }) {
  function updateField(event) {
    const { name, value } = event.target;

    setParty((prev) => ({
      ...prev,
      [name]:
        name === "guests" || name === "budget"
          ? Number(value)
          : value,
    }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="field-label" htmlFor="type">
          <CalendarDays size={16} /> Event type
        </label>
        <select
          id="type"
          name="type"
          value={party.type}
          onChange={updateField}
          className="field"
        >
          <option value="birthday">Birthday party</option>
          <option value="wedding">Wedding</option>
          <option value="anniversary">Anniversary</option>
          <option value="corporate">Corporate event</option>
          <option value="engagement">Engagement</option>
          <option value="other">Other celebration</option>
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="location">
          <MapPin size={16} /> Location
        </label>
        <input
          id="location"
          name="location"
          value={party.location}
          onChange={updateField}
          placeholder="e.g. Kolkata"
          className="field"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="guests">
            <Users size={16} /> Guests
          </label>
          <input
            id="guests"
            name="guests"
            type="number"
            min="1"
            value={party.guests}
            onChange={updateField}
            className="field"
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="budget">
            <Wallet size={16} /> Budget (₹)
          </label>
          <input
            id="budget"
            name="budget"
            type="number"
            min="0"
            value={party.budget}
            onChange={updateField}
            className="field"
            required
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="venueType">
          Preferred venue
        </label>
        <select
          id="venueType"
          name="venueType"
          value={party.venueType}
          onChange={updateField}
          className="field"
        >
          <option value="any">Any suitable venue</option>
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
          <option value="restaurant">Restaurant</option>
          <option value="hotel">Hotel or banquet hall</option>
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="cuisine">
          Food preference
        </label>
        <select
          id="cuisine"
          name="cuisine"
          value={party.cuisine}
          onChange={updateField}
          className="field"
        >
          <option value="any">Any cuisine</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="indian">Indian</option>
          <option value="chinese">Chinese</option>
          <option value="italian">Italian</option>
          <option value="continental">Continental</option>
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="theme">
          Theme and requirements
        </label>
        <textarea
          id="theme"
          name="theme"
          value={party.theme}
          onChange={updateField}
          placeholder="Pastel theme, vegetarian food, balloons..."
          className="field min-h-24 resize-y"
        />
      </div>

      <button className="primary-button w-full" disabled={loading}>
        {loading ? "Planning your party..." : "Generate party plan"}
      </button>
    </form>
  );
}
