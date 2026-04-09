from backend.agents.state import AgentState
from backend.utils.emergency import detect_emergency
from backend.agents.tools import build_tools
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, AIMessage
from backend.config import settings

def _get_llm(client_config):
    # Ensure api_key is available (using dummy for test if not)
    api_key = settings.openai_api_key if settings.openai_api_key else "dummy"
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
    return llm.bind_tools(build_tools(client_config))

async def greeting_node(state: AgentState) -> dict:
    business_name = state["client_config"].get("business_name", "our business")
    system_prompt = f"""You are Alex, the AI assistant for {business_name}.
You answer calls professionally, qualify the caller's needs,
and help them book appointments or get urgent help.
Always be warm but efficient — these are busy tradespeople's customers."""
    
    llm = _get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)
    
    return {"messages": [response], "current_node": "qualify"}

async def qualify_node(state: AgentState) -> dict:
    # Run emergency detection on the latest user message FIRST
    last_message = None
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            last_message = msg.content
            break
            
    is_emergency = state.get("is_emergency", False)
    if last_message and not is_emergency:
        detected, _ = detect_emergency(last_message)
        if detected:
            return {"is_emergency": True}

    business_name = state["client_config"].get("business_name", "our business")
    system_prompt = f"""You are Alex, the AI assistant for {business_name}.
Ask qualifying questions:
1. What is the problem?
2. What is the address / are you in our service area?
3. How urgent is this?

Do not ask all 3 at once — one question per turn."""
    
    llm = _get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)
    
    return {"messages": [response]}

async def emergency_node(state: AgentState) -> dict:
    system_prompt = """This is an emergency. Your ONLY job is to:
1. Confirm you understand the emergency
2. Tell the caller you are connecting them to a technician NOW
3. Call the escalate_call tool immediately
Do not ask more questions. Do not try to solve the problem.
Act fast."""
    
    llm = _get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)
    
    return {"messages": [response]}

def routing_node(state: AgentState) -> str:
    if state.get("is_emergency"):
        return "emergency"
    
    return "qualify"
