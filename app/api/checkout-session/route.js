import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

export async function POST(req) {
  try {
    const amount = 499 * 100;

    const options = {
      amount: amount,
      currency: "INR",
      receipt: "receipt#1",
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.log(error);
    return NextResponse.error();
  }
}
