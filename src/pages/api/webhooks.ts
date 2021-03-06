import { Stripe } from "stripe";
import { NextApiRequest, NextApiResponse } from "next";
import { Readable } from 'stream'
import { stripe } from "../../services/stripe";
import { saveSubscription } from "./_lib/manageSubscription";

async function buffer(readable: Readable){
    const pieces = [];

    for await (const piece of readable){
        pieces.push(
            typeof piece === "string" ? Buffer.from(piece) : piece
        );
    }

    return Buffer.concat(pieces);
}

export const config = {
    api: {
        bodyParser: false,
    }
}

const relevantEvents = new Set([
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted'
]);

export default async (request: NextApiRequest, response: NextApiResponse) => {
    if(request.method === "POST"){
        const readableBuffer = await buffer(request);
        const secret = request.headers['stripe-signature'];

        let event: Stripe.Event;

        try{
            event = stripe.webhooks.constructEvent(readableBuffer, secret, process.env.STRIPE_WEBHOOK_SECRET);
        }catch(error){
            return response.status(400).send(`Webhook error: ${error.message}`);
        }

        const { type } = event;

        if(relevantEvents.has(type)){
            try{
                switch(type){
                    case 'customer.subscription.created':
                    case 'customer.subscription.updated':
                    case 'customer.subscription.deleted':

                        const subscription = event.data.object as Stripe.Subscription;

                        await saveSubscription(
                            subscription.id,
                            subscription.customer.toString(),
                            type === 'customer.subscription.created',
                        );

                        break;
                    case 'checkout.session.completed':
                        const checkoutSession = event.data.object as Stripe.Checkout.Session;

                        await saveSubscription(checkoutSession.subscription.toString(), checkoutSession.customer.toString(), true);

                        break;
                    default:
                        throw new Error('Unhandled event.');
                        break;
                }
            }catch(error){
                return response.json({error: 'Webhook handler failed.'});
            }
        }

        response.status(200).json({received: true});
    }else{
        response.setHeader("Allow", "POST");
        response.status(405).end("Method not allowed");
    }
}