import mongoose from "mongoose";


const messageSchema =
  new mongoose.Schema(
    {
      userId: {
        type: String,
        required: true,
        index: true
      },

      sessionId: {
        type: String,
        required: true,
        index: true
      },

      role: {
        type: String,
        required: true
      },

      content: {
        type: String,
        required: true
      }
    },

    {
      timestamps: true
    }
  );


const preferenceSchema =
  new mongoose.Schema(
    {
      userId: {
        type: String,
        required: true,
        unique: true
      },

      preferences: {
        vegetarian: {
          type: Boolean,
          default: null
        },

        preferredVenueType: {
          type: String,
          default: null
        },

        preferredCuisine: {
          type: String,
          default: null
        },

        preferredTheme: {
          type: String,
          default: null
        },

        otherPreferences: {
          type: [String],
          default: []
        }
      }
    },

    {
      timestamps: true
    }
  );


export const Message =
  mongoose.model(
    "Message",
    messageSchema
  );


export const UserPreference =
  mongoose.model(
    "UserPreference",
    preferenceSchema
  );