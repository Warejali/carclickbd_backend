import Pusher from 'pusher';
import express from 'express';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_APP_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

const router = express.Router();

router.post('/', async (req, res) => {
  const { message } = req.body;

  await pusher.trigger('chat-channel', 'new-message', {
    message,
  });

  return res.status(200).json({ message: 'Message sent' });
});

export const chatPOST = router;

// const chatPOST = async (request: Request) => {
//       const { message } = await request.json();
//       console.log(message, 'message in chat route');

//       await pusher.trigger('chat-channel', 'new-message', {
//             message,
//       });

//       return new Response('Message sent', { status: 200 });
// };

// export { chatPOST };
