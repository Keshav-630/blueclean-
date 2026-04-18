const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    pollutionType: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    severityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    severityBand: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true
    },
    status: {
      type: String,
      enum: ["reported", "verified", "cleaning", "resolved"],
      default: "reported"
    },
    imageUrl: {
      type: String,
      default: ""
    },
    reporterName: {
      type: String,
      default: "Anonymous",
      trim: true
    },
    reporterUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

reportSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Report", reportSchema);
