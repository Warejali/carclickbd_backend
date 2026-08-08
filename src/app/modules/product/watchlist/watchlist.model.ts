import mongoose, { Schema } from 'mongoose';
import { IWatchlist } from './watchlist.interface';

const WatchlistSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

WatchlistSchema.index({ user: 1, product: 1 }, { unique: true });

const Watchlist = mongoose.model<IWatchlist>('Watchlist', WatchlistSchema);

export default Watchlist;
