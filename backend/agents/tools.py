from langchain_core.tools import tool

def build_tools(client_config: dict):
    @tool
    def escalate_call(reason: str, caller_summary: str) -> dict:
        """Escalates the call to a human operator or emergency line.
        Requires exactly 'reason' (string) and 'caller_summary' (string).
        """
        return {"action": "transfer", "phone": client_config.get("emergency_phone_number", ""), "summary": caller_summary, "reason": reason}

    @tool
    def get_business_info(question: str) -> str:
        """Answers queries about the business, services offered, hours, and service area."""
        services = ", ".join(client_config.get("services_offered", []))
        return f"Business: {client_config.get('business_name')}. Hours: {client_config.get('working_hours')}. Services: {services}. Area: {client_config.get('service_area_description')}."

    @tool
    def end_call_gracefully(reason: str) -> str:
        """Ends the call gracefully with a polite goodbye message."""
        if reason == "out_of_area":
            return "I'm sorry, but we don't service that area. Have a great day!"
        elif reason == "not_a_service_we_offer":
            return "I'm sorry, but we don't offer that service. Goodbye."
        return "Thank you for calling. We will be in touch. Goodbye."

    return [escalate_call, get_business_info, end_call_gracefully]
