from telebot import types
from bot_setup import bot
from utils import apply_topup_action, log_auth


def build_topup_admin_markup(ticket_id):
    if not bot:
        return None
    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton("✅ Подтвердить", callback_data=f"topup:approve:{ticket_id}"),
        types.InlineKeyboardButton("❌ Не подтверждаю", callback_data=f"topup:reject:{ticket_id}")
    )
    return markup


def register_handlers(app):
    if not bot:
        return

    @bot.callback_query_handler(func=lambda call: call.data and call.data.startswith('topup:'))
    def handle_topup_callback(call):
        try:
            parts = call.data.split(':')
            if len(parts) != 3:
                return
            action, ticket_id = parts[1], int(parts[2])

            with app.app_context():
                from db import User, TopUpTicket
                admin = User.query.filter_by(telegram_id=str(call.from_user.id)).first()
                if not admin or not admin.is_admin:
                    bot.answer_callback_query(call.id, "Недостаточно прав")
                    return

                ticket = TopUpTicket.query.get(ticket_id)
                if not ticket or ticket.status != 'pending':
                    bot.answer_callback_query(call.id, "Платёж уже обработан")
                    return

                if action == 'approve':
                    apply_topup_action(ticket, admin, approve=True)
                    bot.answer_callback_query(call.id, "Подтверждено")
                elif action == 'reject':
                    apply_topup_action(ticket, admin, approve=False)
                    bot.answer_callback_query(call.id, "Отклонено")
        except Exception as e:
            log_auth('topup_callback_error', error=str(e))
