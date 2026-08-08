import { IUser } from '../../user/user.interface';
import { IBid } from './bids.interface';

// step: 1
export const findHighestBidder = (bids: IBid[]): IBid['user'] | null => {
  return (
    bids?.sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))[0]?.user ||
    null
  );
};

// step: 2
export const calculateHighestBid = (bids: IBid[] | null): string => {
  if (!bids || bids.length === 0) {
    return '0';
  }

  const highestBid =
    bids.sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))[0]
      ?.bidAmount || 0;

  return highestBid.toString();
};

// step: 3
export const assignWinner = (
  isBiddingEnded: boolean,
  highestBidder: IUser | null,
) => {
  return isBiddingEnded && highestBidder
    ? {
        id: highestBidder._id,
        name: highestBidder.name,
        profilePhoto:
          highestBidder.profilePhoto ||
          'https://img.freepik.com/free-photo/office-happy-man-work_144627-6324.jpg?semt=ais_incoming',
      }
    : {};
};
