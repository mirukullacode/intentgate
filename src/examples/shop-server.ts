#!/usr/bin/env node
/**
 * Demo MCP server: a support desk for an online store. The voice-agent demo connects an
 * ElevenLabs agent to these tools through IntentGate. All data is fake and in memory.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const orders: Record<string, { customer: string; item: string; amountInr: number; status: string }> = {
  '1042': { customer: 'C-77', item: 'Wireless earbuds', amountInr: 4999, status: 'Out for delivery, arriving tomorrow' },
  '1043': { customer: 'C-77', item: 'Phone case', amountInr: 599, status: 'Delivered on Oct 8' },
  '2001': { customer: 'C-12', item: 'Smart watch', amountInr: 12999, status: 'Processing' },
};
const payouts: Record<string, string> = { 'C-77': 'priya@okaxis', 'C-12': 'rahul@oksbi' };

const server = new Server({ name: 'shop', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'lookup_order',
      description: 'Get the status of an order by order id.',
      inputSchema: { type: 'object', properties: { order_id: { type: 'string' } }, required: ['order_id'] },
    },
    {
      name: 'issue_refund',
      description: 'Refund an order to the customer payout account on file.',
      inputSchema: {
        type: 'object',
        properties: { order_id: { type: 'string' }, amount_inr: { type: 'number' } },
        required: ['order_id', 'amount_inr'],
      },
    },
    {
      name: 'update_payout_account',
      description: "Change the UPI id a customer's refunds are sent to.",
      inputSchema: {
        type: 'object',
        properties: { customer_id: { type: 'string' }, upi_id: { type: 'string' } },
        required: ['customer_id', 'upi_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const a = (req.params.arguments ?? {}) as Record<string, any>;
  const reply = (text: string, isError = false) => ({ content: [{ type: 'text', text }], isError });
  switch (req.params.name) {
    case 'lookup_order': {
      const o = orders[String(a.order_id)];
      return o ? reply(`Order ${a.order_id}: ${o.item}, ₹${o.amountInr}. ${o.status}.`) : reply('Order not found', true);
    }
    case 'issue_refund': {
      const o = orders[String(a.order_id)];
      if (!o) return reply('Order not found', true);
      return reply(`Refunded ₹${a.amount_inr} for order ${a.order_id} to ${payouts[o.customer]}.`);
    }
    case 'update_payout_account':
      payouts[String(a.customer_id)] = String(a.upi_id);
      return reply(`Payout account for ${a.customer_id} changed to ${a.upi_id}.`);
    default:
      return reply(`Unknown tool ${req.params.name}`, true);
  }
});

await server.connect(new StdioServerTransport());
