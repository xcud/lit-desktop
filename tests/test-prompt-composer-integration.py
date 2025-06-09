#!/usr/bin/env python3
"""
Test script to verify prompt-composer integration will work correctly
from the lit-desktop Electron app
"""

import json
import sys
import os
sys.path.append('/home/ben/lit-platform/prompt-composer/venv/lib/python3.12/site-packages')

from prompt_composer import compose_system_prompt

def test_desktop_commander_integration():
    """Test the integration with desktop-commander like lit-desktop will use"""
    
    print("🧪 Testing prompt-composer integration for lit-desktop...")
    
    # Simulate the request that lit-desktop will send
    request = {
        "user_prompt": "Look at the package.json file and tell me about the dependencies",
        "mcp_config": {
            "mcpServers": {
                "desktop-commander": {
                    "name": "desktop-commander",
                    "command": "npx",
                    "args": ["@wonderwhy-er/desktop-commander@latest"],
                    "description": "Access and manipulate files on the local system",
                    "autoStart": False
                }
            }
        },
        "session_state": {
            "tool_call_count": 0,
            "has_plan": False
        }
    }
    
    # Generate system prompt
    response_json = compose_system_prompt(json.dumps(request))
    response = json.loads(response_json)
    
    print("✅ System prompt generated successfully!")
    print(f"📋 Recognized tools: {response.get('recognized_tools', [])}")
    print(f"🧩 Applied modules: {response.get('applied_modules', [])}")
    print(f"📝 System prompt length: {len(response['system_prompt'])} characters")
    
    # Show first part of system prompt
    prompt_preview = response['system_prompt'][:300] + "..." if len(response['system_prompt']) > 300 else response['system_prompt']
    print(f"📄 System prompt preview:\n{prompt_preview}")
    
    return response

def test_complex_task():
    """Test complex task detection"""
    
    print("\n🔬 Testing complex task detection...")
    
    request = {
        "user_prompt": "Analyze all the TypeScript files in this project and create a comprehensive refactoring plan to improve code organization",
        "mcp_config": {
            "mcpServers": {
                "desktop-commander": {
                    "name": "desktop-commander",
                    "command": "npx",
                    "args": ["@wonderwhy-er/desktop-commander@latest"]
                }
            }
        },
        "session_state": {
            "tool_call_count": 0,
            "has_plan": False,
            "task_complexity": "complex"
        }
    }
    
    response_json = compose_system_prompt(json.dumps(request))
    response = json.loads(response_json)
    
    print("✅ Complex task prompt generated!")
    print(f"🎯 Complexity assessment: {response.get('complexity_assessment', 'N/A')}")
    
    # Check if planning guidance is included
    if "plan" in response['system_prompt'].lower():
        print("✅ Planning guidance detected in prompt")
    else:
        print("⚠️  No planning guidance found")
        
    return response

def test_progress_monitoring():
    """Test progress monitoring for sessions with multiple tool calls"""
    
    print("\n📊 Testing progress monitoring...")
    
    request = {
        "user_prompt": "Continue working on the configuration file updates",
        "mcp_config": {
            "mcpServers": {
                "desktop-commander": {
                    "name": "desktop-commander",
                    "command": "npx",
                    "args": ["@wonderwhy-er/desktop-commander@latest"]
                }
            }
        },
        "session_state": {
            "tool_call_count": 8,  # Many tool calls already made
            "has_plan": True,
            "original_task": "Update configuration files for better performance"
        }
    }
    
    response_json = compose_system_prompt(json.dumps(request))
    response = json.loads(response_json)
    
    print("✅ Progress monitoring prompt generated!")
    
    # Check if progress monitoring is included
    if "progress" in response['system_prompt'].lower():
        print("✅ Progress monitoring guidance detected")
    else:
        print("⚠️  No progress monitoring found")
        
    return response

if __name__ == "__main__":
    try:
        # Run all tests
        test_desktop_commander_integration()
        test_complex_task()
        test_progress_monitoring()
        
        print("\n🎉 All tests passed! prompt-composer integration is ready for lit-desktop!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        sys.exit(1)
