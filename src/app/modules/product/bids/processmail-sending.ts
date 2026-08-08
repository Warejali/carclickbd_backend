import { sendMailerHelper } from '../../../../helper/sendMailHelper';
import schedule from 'node-schedule';
import { Bid } from './bids.model';
import { IBid } from './bids.interface';
const processEndedBids = async () => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Fetch all bids with product information
    const userBids = await Bid.find().sort({ createdAt: -1 }).populate({
      path: 'product',
      select: 'photos.mainPhoto title make model bidInfo  seller',
    });

    if (!userBids || userBids.length === 0) {
      console.log('No bids found to process.');
      return;
    }

    // Identify highest bids for products
    const highestBidsMap = getHighestBids(userBids, now);

    // Process each highest bid
    await Promise.all(
      Array.from(highestBidsMap.values()).map(bid =>
        processBid(bid, now, oneHourAgo),
      ),
    );

    console.log('Bid processing completed.');
  } catch (error) {
    console.error('Error occurred while processing bids:', error);
  }
};

/**
 * Identify the highest bids for each product.
 * @param userBids Array of user bids.
 * @param now Current date and time.
 * @returns Map of product ID to the highest bid.
 */
const getHighestBids = (
  userBids: Array<IBid>,
  now: Date,
): Map<string, IBid> => {
  const highestBidsMap = new Map<string, IBid>();

  userBids.forEach(bid => {
    const product = bid.product as any;
    const biddingDuration = product?.bidInfo?.biddingDuration;

    // Skip if the bidding is still active or undefined
    if (!biddingDuration || new Date(biddingDuration.endBid) > now) return;

    const productId = product._id.toString();

    // Update the map if no bid exists or the current bid is higher
    if (
      !highestBidsMap.has(productId) ||
      parseFloat(bid.bidAmount) >
        parseFloat(highestBidsMap.get(productId)!.bidAmount)
    ) {
      highestBidsMap.set(productId, bid);
    }
  });

  return highestBidsMap;
};

/**
 * Process a single bid and notify the winner.
 * @param bid The highest bid for a product.
 * @param now Current date and time.
 * @param oneHourAgo Time one hour ago from now.
 */
const processBid = async (bid: IBid, now: Date, oneHourAgo: Date) => {
  const product = bid.product as any;
  const endBidTime = new Date(product?.bidInfo?.biddingDuration?.endBid);

  // Skip processing if the bidding ended more than 1 hour ago or hasn't ended yet
  if (endBidTime < oneHourAgo || endBidTime > now) return;

  const highestBid = product.bidInfo;
  if (!highestBid) return;

  const winner = bid.user as any;
  const seller = product.seller as any;
  if (!winner) return;

  const bidAmount = highestBid.bidAmount || 0;

  try {
    const emailHtml = generateWinnerEmail(
      winner.name,
      product.title,
      bidAmount,
    );

    await sendMailerHelper.sendMail({
      to: winner.email,
      subject: `Congratulations! You won the bid for ${product.title}`,
      html: emailHtml,
    });

    await sendMailerHelper.sendMail({
      to: seller.email,
      subject: `Your product ${product.title} has been sold!`,
      html: `
          <p>Dear ${seller.name},</p>
          <p>Congratulations! Your product "<strong>${product.title}</strong>" has been successfully sold through CarEBid.</p>
          <p>The winning bid amount is: <strong>$${bidAmount}</strong>.</p>
          <p>The buyer's details are as follows:</p>
          <ul>
            <li><strong>Name:</strong> ${winner.name}</li>
            <li><strong>Email:</strong> ${winner.email}</li>
          </ul>
          <p>Please coordinate with the buyer for further steps regarding payment and delivery.</p>
          <p>Thank you for choosing CarEBid!</p>
          <p>Best regards,<br>CarEBid Team</p>
        `,
    });

    // Mark the product as processed
    product.bidInfo.isBedded = true;
    await product.save();

    console.log(`Email sent to ${winner.email} for product ${product.title}.`);
  } catch (error) {
    console.error(`Failed to process bid for product ${product.title}:`, error);
  }
};

/**
 * Generate email content for the winner.
 * @param name Winner's name.
 * @param productTitle Product title.
 * @param bidAmount Winning bid amount.
 * @returns Email content in HTML format.
 */
const generateWinnerEmail = (
  name: string,
  productTitle: string,
  bidAmount: number,
): string => `
    <p>Dear ${name},</p>
    <p>Congratulations! You have won the bid for the product "<strong>${productTitle}</strong>".</p>
    <p>Your winning bid amount is: <strong>$${bidAmount}</strong>.</p>
    <p>Please proceed with the payment and further actions.</p>
    <p>Best regards,<br>CarEBid Team</p>
  `;

// Run the scheduler every 50 minutes
schedule.scheduleJob('*/50 * * * *', async () => {
  await processEndedBids();
});
